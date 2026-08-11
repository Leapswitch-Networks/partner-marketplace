"""Credential encryption and masking (Module 7).

## This module does NOT derive its own key

`app/core/encryption.py` already exists, is already used for 2FA secrets, and
already does the part that is easy to get wrong: HKDF from `settings.SECRET_KEY`
with a fixed info string, so the encryption key is domain-separated from the JWT
signing key. **Everything here delegates to it.**

That is a deliberate refusal to write a second cipher. Two encryption modules
means two key derivations, and the failure mode is silent and unrecoverable: a
value written by one is undecryptable by the other, so a credential saved today
reads back as corrupt after a refactor moves it to the other helper. One key,
one module.

What is genuinely new here — and what this file is for — is the *credential*
layer: masking, the mask/never-mask decision, and a startup check.

## Fail loud, never silently plaintext

`assert_encryption_available()` is called when the credential router loads. A
credential store that quietly writes plaintext because a key was missing is
worse than no credential store: the operator believes the secrets are encrypted,
so nothing prompts them to rotate.

`SECRET_KEY` is a required field on `Settings`, so an absent one already fails at
import with a Pydantic error, and production additionally enforces a length and
entropy floor. This check closes the remaining gap — a key that is *present* but
cannot actually produce a working cipher — by encrypting and decrypting a probe
value at startup rather than discovering it on the first credential write.

## Nothing here ever logs a value

No plaintext, and no ciphertext, in any exception message, log line or repr.
`InvalidToken` is caught and re-raised as a bare failure, because
`cryptography`'s own exceptions do not carry the value but a naive
`raise ValueError(f"could not decrypt {value}")` written later would. The rule is
stated so the next edit keeps it.
"""

from __future__ import annotations

import logging

from app.core import encryption

logger = logging.getLogger("app.crypto")

#: How many trailing characters a mask leaves visible.
#:
#: Four, matching the reference's `getMaskedValueAttribute($visibleChars = 4)`.
#: Enough to answer "is this the key I think it is?" without being enough to
#: reconstruct one.
MASK_VISIBLE_CHARS = 4

#: The mask glyph. The reference uses `*`; a bullet reads as deliberate masking
#: rather than as a literal asterisk that might be part of the value.
MASK_CHAR = "•"


class EncryptionUnavailable(RuntimeError):
    """The cipher cannot be built or does not round-trip.

    Deliberately carries no value and no key material — only the fact.
    """


def assert_encryption_available() -> None:
    """Prove the cipher works, or refuse to start.

    Encrypts and decrypts a fixed probe string. The probe is a constant, not a
    real secret, so nothing sensitive exists even momentarily to be logged.
    """
    probe = "encryption-self-test"
    try:
        restored = encryption.decrypt(encryption.encrypt(probe))
    except Exception as exc:  # noqa: BLE001 - re-raised without detail below
        raise EncryptionUnavailable(
            "Credential encryption is not available: the cipher could not be "
            "built from SECRET_KEY. Refusing to start rather than storing "
            "credentials in plaintext."
        ) from exc

    if restored != probe:
        raise EncryptionUnavailable(
            "Credential encryption self-test failed: a value did not survive an "
            "encrypt/decrypt round trip. Refusing to start rather than storing "
            "credentials in plaintext."
        )


def encrypt_value(plaintext: str) -> str:
    """Encrypt one field value for storage."""
    return encryption.encrypt(plaintext)


def decrypt_value(ciphertext: str | None) -> str | None:
    """Decrypt a stored value, or `None` if it cannot be read.

    ## Where this deliberately diverges from the reference

    LeapDesk's accessor catches a decrypt failure and **returns the raw stored
    value**, so that a key rotation degrades rather than crashes. The intent is
    right; the behaviour is not portable here, because our raw stored value is
    Fernet ciphertext — returning it would render a wall of base64 into the UI as
    though it were the credential, and a `reveal` would hand the operator a
    string they might paste somewhere believing it was their key.

    `None` instead, and the caller reports the field as unreadable. Same
    degradation, honest about which one it is. `core.encryption.decrypt` already
    returns `None` on `InvalidToken` for the same reason.
    """
    return encryption.decrypt(ciphertext)


def should_mask(field_type: str | None, is_encrypted: bool) -> bool:
    """Does this field get masked in a response?

    The reference's `shouldMask()` exactly: a password field, or any encrypted
    field. The `password` clause is not redundant — a field can be typed
    `password` with `is_encrypted` false (a value that is secret to *show* but
    not worth encrypting at rest), and it must still not be rendered.
    """
    return field_type == "password" or bool(is_encrypted)


def mask(value: str | None, visible: int = MASK_VISIBLE_CHARS) -> str:
    """Mask a plaintext value, keeping its last few characters.

    The reference's algorithm, translated:

    * `None` or empty → empty string. Not a row of bullets: "not set" and "set
      to something short" are different facts and the screen has to distinguish
      them, or an operator cannot tell a missing credential from a present one.
    * `len <= visible` → **fully masked**. Showing the last 4 of a 4-character
      value shows all of it, which is the bug the reference's own
      `strlen($value) <= $visibleChars` branch exists to prevent.
    * otherwise → bullets for everything but the last `visible` characters.

    The mask length tracks the real length, which leaks it. That is the
    reference's behaviour and it is a deliberate trade: an operator comparing a
    masked value against the key in their password manager needs the shape.
    """
    if not value:
        return ""
    if len(value) <= visible:
        return MASK_CHAR * len(value)
    return MASK_CHAR * (len(value) - visible) + value[-visible:]


def mask_stored(
    ciphertext: str | None, *, field_type: str | None, is_encrypted: bool
) -> str:
    """Mask a value as stored — decrypting first when it is encrypted.

    ## The trade-off, stated rather than hidden

    Producing a last-4 mask requires the plaintext, so a list of ten credentials
    decrypts ten secrets into memory to render ten strings that contain four
    characters each. The alternative is a fixed `••••••••` that needs no
    decryption — which is what the reference's own `show()` endpoint renders,
    while its model accessor does the last-4 version.

    Last-4 is kept because it is the one that answers the operator's actual
    question ("is the live key installed, or the old one?"), and because a fixed
    mask makes every credential look identical, including the ones that are
    empty. The plaintext never leaves this process: the return value is the mask.

    A value that cannot be decrypted returns a fixed marker rather than an empty
    string, so "unreadable — probably a rotated SECRET_KEY" does not read as
    "not configured".
    """
    if ciphertext is None:
        return ""

    if not is_encrypted:
        # Stored in the clear by declaration. Still masked if the field is typed
        # `password`, per `should_mask`.
        return mask(ciphertext) if should_mask(field_type, False) else ciphertext

    plaintext = decrypt_value(ciphertext)
    if plaintext is None:
        logger.warning("crypto: a stored credential value could not be decrypted")
        return UNREADABLE_MARKER

    return mask(plaintext)


#: Shown where a value exists but cannot be decrypted. Distinguishable from both
#: "" (not set) and a normal mask, so the screen can say which problem it is.
UNREADABLE_MARKER = "— unreadable —"
