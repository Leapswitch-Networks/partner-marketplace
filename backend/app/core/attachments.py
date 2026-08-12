"""Validation for files attached to an outbound email.

Ported from the reference's `attachments.*` rule on `UserController::sendEmail`
— `max:25600` KB, mimes `pdf,doc,docx,xls,xlsx,jpg,jpeg,png` — with the checks
this codebase already applies to its other upload path. `core/images.py` verifies
magic bytes rather than trusting the declared MIME type, and an attachment is the
*more* exposed of the two: a logo is rendered by our own page, an attachment is
opened by whoever receives it, on a machine we do not control.

**Three limits are ours, not the reference's, and each closes something its rule
leaves open:**

1. **A cap on the number of files.** The reference caps each file at 25 MB and
   says nothing about how many. Two hundred of them is five gigabytes buffered
   before a single validation rule runs.
2. **A cap on the total.** Same reason, from the other direction.
3. **Magic bytes.** Laravel's `mimes:` rule guesses from content too, so this is
   closer to parity than divergence — but it is stated here because the
   equivalent trust in a client-declared `Content-Type` would be a hole.

**What this does not do is decide the file is safe to open.** No allowlist can:
a valid PDF can carry an exploit and a valid `.xls` can carry a macro. What it
establishes is that the file is the kind of thing it says it is, and that one
request cannot exhaust the process. Anti-virus scanning is a separate control and
we do not have one — recorded here rather than implied away.
"""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import HTTPException, status

#: Per file. The reference's `max:25600` KB, in bytes.
MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024

#: Across the request. Ours — see the module docstring. Equal to the per-file cap
#: on purpose: one 25 MB file or five 5 MB files, never 125 MB either way.
MAX_TOTAL_BYTES = 25 * 1024 * 1024

#: Ours. Five is more than any real "here are the documents" email and small
#: enough that the validation loop can never be the expensive part.
MAX_ATTACHMENTS = 5

#: extension -> (MIME type sent to the mail server, magic-byte prefixes).
#:
#: Several extensions share a prefix and that is expected, not a weakness:
#: `.docx`/`.xlsx` are ZIP containers and `.doc`/`.xls` are OLE2 compound files.
#: The signature proves the container; the extension picks the member. What it
#: rules out is the case that matters — a `.exe` or a script renamed to `.pdf`.
ALLOWED: dict[str, tuple[str, tuple[bytes, ...]]] = {
    "pdf": ("application/pdf", (b"%PDF-",)),
    "png": ("image/png", (b"\x89PNG\r\n\x1a\n",)),
    "jpg": ("image/jpeg", (b"\xff\xd8\xff",)),
    "jpeg": ("image/jpeg", (b"\xff\xd8\xff",)),
    "doc": ("application/msword", (b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1",)),
    "xls": ("application/vnd.ms-excel", (b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1",)),
    "docx": (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        (b"PK\x03\x04",),
    ),
    "xlsx": (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        (b"PK\x03\x04",),
    ),
}


@dataclass(frozen=True)
class Attachment:
    """A validated file, ready to hand to `mail_service`."""

    filename: str
    content: bytes
    content_type: str

    @property
    def maintype(self) -> str:
        return self.content_type.split("/", 1)[0]

    @property
    def subtype(self) -> str:
        return self.content_type.split("/", 1)[1]


def _reject(message: str) -> None:
    # 422, not 400: this is a validation failure on a field, and it is the status
    # the rest of the API uses for one. `extractApiError` on the frontend reads
    # the 422 branch, so the message reaches the user rather than being swallowed.
    raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, message)


def safe_filename(name: str | None) -> str:
    """Strip any path from a client-supplied name, and bound its length.

    A filename arrives from the browser and is used as the attachment's name in
    the outgoing message. `../../etc/passwd` never reaches a filesystem here —
    nothing is written to disk — but it would reach the recipient's mail client,
    which does write to disk.
    """
    cleaned = (name or "").replace("\\", "/").rsplit("/", 1)[-1].strip()
    cleaned = "".join(ch for ch in cleaned if ch.isprintable() and ch not in '"\r\n')
    return cleaned[:120] or "attachment"


def validate(files: list[tuple[str | None, bytes]]) -> list[Attachment]:
    """Check a batch of `(filename, content)` pairs. Raises 422 on the first bad one.

    Returns the validated attachments in the order given. An empty list in gives
    an empty list back — sending with no attachment is the normal case and is not
    an error.
    """
    if not files:
        return []

    if len(files) > MAX_ATTACHMENTS:
        _reject(f"Attach at most {MAX_ATTACHMENTS} files ({len(files)} given).")

    attachments: list[Attachment] = []
    total = 0

    for raw_name, content in files:
        name = safe_filename(raw_name)
        extension = name.rsplit(".", 1)[-1].lower() if "." in name else ""

        if extension not in ALLOWED:
            _reject(
                f"'{name}' is not an allowed file type. "
                f"Accepted: {', '.join(sorted(ALLOWED))}."
            )
        if not content:
            _reject(f"'{name}' is empty.")
        if len(content) > MAX_ATTACHMENT_BYTES:
            _reject(f"'{name}' is larger than {MAX_ATTACHMENT_BYTES // (1024 * 1024)} MB.")

        total += len(content)
        if total > MAX_TOTAL_BYTES:
            _reject(
                f"The attachments total more than {MAX_TOTAL_BYTES // (1024 * 1024)} MB."
            )

        content_type, signatures = ALLOWED[extension]
        if not any(content.startswith(signature) for signature in signatures):
            # Deliberately does not say which bytes were expected. The message is
            # for someone who attached the wrong file, not for someone probing
            # what the check looks at.
            _reject(f"'{name}' is not a valid {extension.upper()} file.")

        attachments.append(
            Attachment(filename=name, content=content, content_type=content_type)
        )

    return attachments
