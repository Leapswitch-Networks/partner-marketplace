"""A deterministic last pass over the assistant's reply, before anyone reads it.

Ported from the reference's `OutputGuard`. Pure, side-effect free, and it runs on
**every** reply — including one produced entirely from tool output that has
already been redacted. That is defence in depth on purpose: the redaction upstream
covers columns it knows are secret, and this covers anything shaped like a secret
however it got into the text.

**PII is deliberately not blocked.** This is an internal staff tool and staff
legitimately need a customer's email address or phone number; a guard that
redacted them would make the assistant useless for the work it exists to do. The
two things guarded are the two that should never appear in a reply at all:
credential material, and money quoted in the wrong currency.

A currency mismatch **flags but does not redact** — the number may well be
correct and merely unlabelled, and silently deleting a figure from an answer is
worse than surfacing one for review.
"""

from __future__ import annotations

import re

REDACTION = "[redacted]"

#: Credential shapes. Each is anchored on a vendor prefix rather than on entropy,
#: because "looks random" matches order ids and hashes and would redact half of
#: any legitimate answer.
SECRET_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\bsk-ant-[A-Za-z0-9_-]{6,}"),          # Anthropic
    re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{6,}"),        # Slack
    re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}"),         # GitHub
    re.compile(r"\bAKIA[0-9A-Z]{12,}"),                  # AWS access key id
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),   # PEM private keys
    # Ours, not the reference's: our own credential store encrypts with Fernet,
    # whose ciphertext is instantly recognisable. A reply containing one would
    # mean a stored value had escaped `api_credential_values` — the exact thing
    # Module 7 exists to prevent — so it is redacted and flagged loudly.
    re.compile(r"\bgAAAAA[A-Za-z0-9_\-=]{20,}"),
)

#: Money in anything but rupees. We quote in ₹.
NON_INR_CURRENCY = re.compile(r"(?:\$|USD|US\$|€|EUR|£|GBP)\s?\d", re.IGNORECASE)

FLAG_SECRET = "secret_redacted"
FLAG_CURRENCY = "non_inr_currency"


def sanitize(reply: str) -> tuple[str, list[str]]:
    """Return `(cleaned_reply, flags)`.

    Flags are for the caller to log. Nothing raises: a guard that threw would
    turn a suspicious answer into a 500, and the user would learn nothing while
    the reply — the evidence — was discarded.
    """
    text = reply or ""
    flags: list[str] = []

    for pattern in SECRET_PATTERNS:
        cleaned = pattern.sub(REDACTION, text)
        if cleaned != text:
            if FLAG_SECRET not in flags:
                flags.append(FLAG_SECRET)
            text = cleaned

    if NON_INR_CURRENCY.search(text):
        flags.append(FLAG_CURRENCY)

    return text, flags
