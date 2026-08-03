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
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger("app.mail")


class MailError(Exception):
    """Raised only by `send_or_raise`. The normal path returns a boolean."""


def _build(to: str, subject: str, body: str) -> EmailMessage:
    message = EmailMessage()
    message["From"] = f"{settings.MAIL_FROM_NAME} <{settings.MAIL_FROM}>"
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)
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


def send(to: str, subject: str, body: str) -> bool:
    """Deliver a message. Returns True if it was sent, False if sending failed.

    A `console` send always succeeds — it is a log write.
    """
    backend = settings.MAIL_BACKEND.lower()

    if backend == "console":
        # The body is logged in full and deliberately: in development the link is
        # the only way to complete the flow. This is also why `console` must never
        # be the backend in a deployed environment — a reset link in a log file is
        # a valid credential to anyone who can read logs. DEPLOYMENT § 0 lists it.
        logger.info(
            "email not sent (console backend)",
            extra={"to": to, "subject": subject, "body": body},
        )
        return True

    if backend != "smtp":
        logger.error("unknown MAIL_BACKEND", extra={"backend": settings.MAIL_BACKEND})
        return False

    try:
        _send_smtp(_build(to, subject, body))
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


def send_invitation(to: str, accept_url: str, inviter_name: str | None, expires_days: int) -> bool:
    body = (
        f"You have been invited to Partner Marketplace"
        f"{f' by {inviter_name}' if inviter_name else ''}.\n\n"
        f"Accept the invitation:\n{accept_url}\n\n"
        f"The link expires in {expires_days} day{'s' if expires_days != 1 else ''}. "
        f"If you were not expecting this, you can ignore this message.\n"
    )
    return send(to, "You have been invited to Partner Marketplace", body)


def send_email_verification(to: str, verify_url: str, expires_hours: int) -> bool:
    body = (
        "Please confirm this email address for your Partner Marketplace account.\n\n"
        f"Confirm your address:\n{verify_url}\n\n"
        f"The link expires in {expires_hours} hour{'s' if expires_hours != 1 else ''}.\n\n"
        "If you did not create this account, you can ignore this message — nothing "
        "will be activated without it.\n"
    )
    return send(to, "Confirm your email address", body)


def send_password_reset(to: str, reset_url: str, expires_hours: int) -> bool:
    body = (
        "A password reset was requested for this address.\n\n"
        f"Reset your password:\n{reset_url}\n\n"
        f"The link expires in {expires_hours} hour{'s' if expires_hours != 1 else ''}. "
        "If you did not request this, no action is needed — your password has not changed.\n"
    )
    return send(to, "Reset your Partner Marketplace password", body)
