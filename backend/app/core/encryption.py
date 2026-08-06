"""Symmetric encryption for secrets that must be recoverable (PM-34).

**Not for passwords.** Passwords are hashed with bcrypt and never decrypted; that
is `core/security.py` and nothing here changes it. This module exists for the
narrow set of values the server has to be able to *read back* — a TOTP secret
being the case that forced it, since verifying a code requires the original secret.

**Why encrypt at all, when it is in our own database?** A TOTP secret is a second
factor. Stored in the clear, anyone who obtains a database dump — a backup on a
laptop, a restored snapshot, a read-only reporting replica — can generate valid
codes for every account that enabled 2FA, and the second factor silently becomes
no factor. Laravel encrypts these columns for the same reason, which is why
LeapDesk's `two_factor_secret` is not readable from its database either.

**Key derivation.** The key comes from `SECRET_KEY`, run through HKDF with a fixed
info string. Deriving rather than reusing `SECRET_KEY` directly matters for two
reasons: Fernet requires a 32-byte urlsafe-base64 key and `SECRET_KEY` is
arbitrary text, and a distinct info string means the encryption key and the JWT
signing key are different values even though they share one secret. Reusing one
key for two purposes is how a signing oracle becomes a decryption oracle.

**The operational consequence, stated plainly: rotating `SECRET_KEY` makes every
encrypted value undecryptable.** For 2FA that means every enrolled user must
re-enrol. That is a real cost of this design and the alternative — a separate
`ENCRYPTION_KEY` — trades it for a second secret to manage and lose. `SECRET_KEY`
rotation already invalidates every token and signs everyone out, so it is already
not a routine act; this raises the stakes rather than introducing them. Documented
in AUTHENTICATION.md so it is not discovered during an incident.
"""

from __future__ import annotations

import base64

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from app.core.config import settings

#: Separates this key from any other use of SECRET_KEY. Changing this string
#: invalidates every previously encrypted value, exactly as rotating the secret
#: would — so it is fixed, not configurable.
_HKDF_INFO = b"partner-marketplace/field-encryption/v1"


def _fernet() -> Fernet:
    """Build the cipher. Cheap enough not to cache, and caching would hold the
    key alive across a `SECRET_KEY` change during development reload."""
    derived = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        # No salt: a salt would have to be stored per value, and the whole point
        # of HKDF here is deterministic derivation from one configured secret.
        # The info string provides the domain separation that matters.
        salt=None,
        info=_HKDF_INFO,
    ).derive(settings.SECRET_KEY.encode("utf-8"))
    return Fernet(base64.urlsafe_b64encode(derived))


def encrypt(plaintext: str) -> str:
    """Encrypt a string for storage. Output is urlsafe base64 text."""
    return _fernet().encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt(ciphertext: str | None) -> str | None:
    """Decrypt a stored value, or return None if it cannot be read.

    Returns None rather than raising on a bad value. The realistic cause is a
    rotated `SECRET_KEY`, and the correct behaviour then is "this second factor no
    longer exists" — which the caller handles as a failed verification — rather
    than a 500 that locks the user out of an endpoint they cannot fix. The caller
    must therefore treat None as "no secret", never as "any code will do".
    """
    if not ciphertext:
        return None
    try:
        return _fernet().decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except (InvalidToken, ValueError, TypeError):
        return None
