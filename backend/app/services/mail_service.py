"""Outbound email (TECH_DEBT PM-27).

Two backends, chosen by `MAIL_BACKEND`:

  * ``console`` (default) — writes the message to the log instead of sending it.
    Local development needs no SMTP server, and the accept link or reset link is
    right there in `docker compose logs backend`.
  * ``smtp`` — sends for real via `smtplib`.

**Sending never breaks the operation that triggered it.** Creating an invitation
writes a row; sending the email is a side effect that can fail for reasons that
have nothing to do with the request — a wrong password, a blocked port, a
greylisting relay. If a transport error propagated, the caller would see a 500
for an invitation that was in fact created, and retrying would then fail with
"a pending invitation already exists". So failures are logged and reported back
as a boolean, and the caller decides what to tell the user.

That decision has a consequence worth stating: **a failed send is invisible to
the user unless the caller surfaces it.** The routers handle this by keeping
`accept_url` in the response whenever delivery did not happen, so an
administrator always has a way to complete the invitation by hand.

`console` is the default rather than `smtp` on purpose. An unconfigured `smtp`
backend fails on every send; an unconfigured `console` backend works. The
failure mode of guessing wrong should be "the email is in the log", not "no user
can ever be invited".
"""

from __future__ import annotations

import logging
import smtplib
from collections.abc import Sequence
from email.message import EmailMessage

from app.core.attachments import Attachment
from app.core.config import settings

logger = logging.getLogger("app.mail")


class MailError(Exception):
    """Raised only by `send_or_raise`. The normal path returns a boolean."""


def _build(
    to: str,
    subject: str,
    body: str,
    *,
    attachments: Sequence[Attachment] = (),
    bcc: str | None = None,
    from_name: str | None = None,
) -> EmailMessage:
    message = EmailMessage()
    # The address is always ours — only the display name may be overridden, and
    # only by a caller that has already established who the sender is. Letting a
    # caller set the address would make this a relay for anyone who reaches it.
    message["From"] = f"{from_name or settings.MAIL_FROM_NAME} <{settings.MAIL_FROM}>"
    message["To"] = to
    if bcc:
        # A real Bcc header, not a second send. `smtplib.send_message` expands it
        # into the envelope and strips it from the transmitted headers, so the
        # recipient does not learn who was copied — and a 20 MB attachment is
        # uploaded once rather than twice.
        message["Bcc"] = bcc
    message["Subject"] = subject
    message.set_content(body)
    for attachment in attachments:
        message.add_attachment(
            attachment.content,
            maintype=attachment.maintype,
            subtype=attachment.subtype,
            filename=attachment.filename,
        )
    return message


def _send_smtp(message: EmailMessage) -> None:
    if not settings.SMTP_HOST:
        raise MailError("MAIL_BACKEND is 'smtp' but SMTP_HOST is not set")

    if settings.SMTP_USE_SSL:
        client: smtplib.SMTP = smtplib.SMTP_SSL(
            settings.SMTP_HOST, settings.SMTP_PORT, timeout=settings.SMTP_TIMEOUT_SECONDS
        )
    else:
        client = smtplib.SMTP(
            settings.SMTP_HOST, settings.SMTP_PORT, timeout=settings.SMTP_TIMEOUT_SECONDS
        )

    with client:
        if settings.SMTP_USE_TLS and not settings.SMTP_USE_SSL:
            client.starttls()
        if settings.SMTP_USERNAME:
            client.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        client.send_message(message)


def send(
    to: str,
    subject: str,
    body: str,
    *,
    attachments: Sequence[Attachment] = (),
    bcc: str | None = None,
    from_name: str | None = None,
) -> bool:
    """Deliver a message. Returns True if it was sent, False if sending failed.

    A `console` send always succeeds — it is a log write.

    The three keyword arguments are used only by the ad-hoc user email; every
    other caller sends a plain text-only message and is unaffected.
    """
    backend = settings.MAIL_BACKEND.lower()

    if backend == "console":
        # The body is logged in full and deliberately: in development the link is
        # the only way to complete the flow. This is also why `console` must never
        # be the backend in a deployed environment — a reset link in a log file is
        # a valid credential to anyone who can read logs. DEPLOYMENT § 0 lists it.
        logger.info(
            "email not sent (console backend)",
            extra={
                "to": to,
                "subject": subject,
                "body": body,
                # Names and sizes only. Logging an attachment's bytes would put a
                # document someone chose to send to one person into a log file
                # read by everyone with shell access.
                "attachments": [
                    f"{a.filename} ({len(a.content)} bytes)" for a in attachments
                ],
                "bcc": bcc,
            },
        )
        return True

    if backend != "smtp":
        logger.error("unknown MAIL_BACKEND", extra={"backend": settings.MAIL_BACKEND})
        return False

    try:
        _send_smtp(
            _build(
                to,
                subject,
                body,
                attachments=attachments,
                bcc=bcc,
                from_name=from_name,
            )
        )
    except (smtplib.SMTPException, OSError, MailError) as exc:
        # Never log the body here: a reset email contains a working token, and an
        # SMTP failure is exactly when someone would be reading the logs.
        logger.error(
            "email send failed: %s: %s",
            type(exc).__name__,
            exc,
            extra={"to": to, "subject": subject},
        )
        return False

    logger.info("email sent", extra={"to": to, "subject": subject})
    return True


# --- Messages ---------------------------------------------------------------
#
# Plain text, no HTML. Every client renders it, nothing needs a template engine,
# and there is no layout to break. Revisit when someone wants branding — that is
# a product decision, not a technical gap.


def send_invitation(
    to: str,
    accept_url: str,
    inviter_name: str | None,
    expires_days: int,
    *,
    role_name: str | None = None,
    note: str | None = None,
    # The caller resolves this, not us: this module stays free of database
    # imports, but the name shown here must be the branding-screen override
    # (`app_settings.app_name`), not the build-time env constant. Falls back to
    # `settings.APP_NAME` when a caller has no DB session to resolve it from.
    app_name: str | None = None,
) -> bool:
    """The invitation email.

    **The role is named.** It is the single most load-bearing fact in the
    message — it is what the invitee is being asked to accept — and it was
    missing. The reference names it too.

    **The note is included.** `user_invitation.note`'s column comment has always
    read "Optional message included in the email", and nothing ever passed it
    here, so an admin could type a message that the invitee never saw. Either the
    field delivers or the comment is a lie; this makes it deliver.

    Expiry is interpolated rather than hardcoded. The reference's template says
    "expires in 7 days" as a literal, which becomes wrong the moment the window
    changes.
    """
    name = app_name or settings.APP_NAME
    lines = [
        f"You have been invited to {name}"
        f"{f' by {inviter_name}' if inviter_name else ''}.",
    ]
    if role_name:
        lines.append(f"\nYou are being invited as: {role_name}")
    if note:
        # Quoted and attributed, so it reads as a human message rather than as
        # something the system is asserting.
        attribution = f"{inviter_name} says" if inviter_name else "Message"
        lines.append(f"\n{attribution}:\n{note.strip()}")

    lines.append(f"\nAccept the invitation:\n{accept_url}")
    lines.append(
        f"\nThe link expires in {expires_days} day{'s' if expires_days != 1 else ''}. "
        "If you were not expecting this, you can ignore this message."
    )
    return send(to, f"You have been invited to {name}", "\n".join(lines) + "\n")


def send_email_verification(
    to: str,
    verify_url: str,
    expires_hours: int,
    *,
    app_name: str | None = None,  # see send_invitation's app_name for why the caller resolves this
) -> bool:
    name = app_name or settings.APP_NAME
    body = (
        f"Please confirm this email address for your {name} account.\n\n"
        f"Confirm your address:\n{verify_url}\n\n"
        f"The link expires in {expires_hours} hour{'s' if expires_hours != 1 else ''}.\n\n"
        "If you did not create this account, you can ignore this message — nothing "
        "will be activated without it.\n"
    )
    return send(to, "Confirm your email address", body)


def send_password_reset(
    to: str,
    reset_url: str,
    expires_hours: int,
    *,
    app_name: str | None = None,  # see send_invitation's app_name for why the caller resolves this
) -> bool:
    body = (
        "A password reset was requested for this address.\n\n"
        f"Reset your password:\n{reset_url}\n\n"
        f"The link expires in {expires_hours} hour{'s' if expires_hours != 1 else ''}. "
        "If you did not request this, no action is needed — your password has not changed.\n"
    )
    return send(to, f"Reset your {app_name or settings.APP_NAME} password", body)


def send_password_otp(
    to: str,
    code: str,
    expires_minutes: int,
    *,
    app_name: str | None = None,  # see send_invitation's app_name for why the caller resolves this
) -> bool:
    """A 6-digit code proving the recipient controls this address.

    Deliberately carries **no link**. This code is requested from inside an
    authenticated settings page, so there is nothing to click through to — and a
    code with no accompanying URL cannot be turned into a phishing landing page by
    whoever forwards the mail.
    """
    name = app_name or settings.APP_NAME
    body = (
        f"Use this code to change your {name} password:\n\n"
        f"    {code}\n\n"
        f"It expires in {expires_minutes} minute{'s' if expires_minutes != 1 else ''} "
        "and can be used once.\n\n"
        "If you did not request it, no action is needed — your password has not "
        "changed, and nobody can use this code without access to your account.\n"
    )
    return send(to, "Your password change code", body)
