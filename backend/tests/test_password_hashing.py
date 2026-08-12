"""PM-1: passwords are hashed, and `verify_password` is the only comparison.

This module previously stored and compared plaintext, deliberately, at every
layer: `hash_password` returned its input unchanged, `verify_password` was
`plain == stored`, and login was a raw `!=`. Migration `e7b41c9a2d10` hashed every
existing row in place.

The regression these tests guard against is the one that looks like a
simplification. Anyone reintroducing a plaintext comparison "temporarily" gets a
working login and a failing suite.
"""

import pytest

from app.core.security import hash_password, is_bcrypt_digest, verify_password


def test_hash_is_not_the_plaintext():
    """The literal PM-1 regression: `hash_password` used to return its input."""
    plain = "CorrectHorse1"
    digest = hash_password(plain)
    assert digest != plain
    assert plain not in digest


def test_hash_is_a_bcrypt_digest():
    digest = hash_password("CorrectHorse1")
    assert is_bcrypt_digest(digest)
    assert digest.startswith("$2b$")


def test_correct_password_verifies():
    assert verify_password("CorrectHorse1", hash_password("CorrectHorse1")) is True


def test_wrong_password_does_not_verify():
    assert verify_password("WrongHorse1", hash_password("CorrectHorse1")) is False


def test_same_password_hashes_differently_each_time():
    """A per-hash salt. Without it, identical passwords share a digest, and one
    cracked hash reveals every account using that password."""
    plain = "CorrectHorse1"
    assert hash_password(plain) != hash_password(plain)


@pytest.mark.parametrize("stored", [None, ""])
def test_google_only_account_cannot_authenticate(stored):
    """Google accounts carry `password = NULL` and must not accept a blank string.

    A comparison written as `stored == plain` would return True here for
    `plain=""` — an account with no password would authenticate with no password.
    """
    assert verify_password("", stored) is False
    assert verify_password("anything", stored) is False


def test_empty_password_never_verifies_against_a_real_hash():
    assert verify_password("", hash_password("CorrectHorse1")) is False


@pytest.mark.parametrize("stored", ["plaintext-password", "not$a$hash", "$2b$broken"])
def test_a_non_bcrypt_stored_value_is_a_failed_login_not_a_pass(stored):
    """The login path must not accept a legacy plaintext row.

    Accepting one would mean keeping a plaintext comparison in the codebase, which
    is what PM-1 removed. Such a row cannot authenticate and needs a password reset
    — that is the correct outcome, not a bug to work around.
    """
    assert verify_password(stored, stored) is False


def test_bcrypt_72_byte_limit_is_handled_explicitly():
    """bcrypt silently truncates past 72 bytes; some builds raise instead.

    Doing it explicitly keeps behaviour identical across versions. The consequence
    is real and worth stating: two passwords sharing their first 72 bytes are the
    same password to bcrypt.
    """
    base = "A1" + "x" * 100
    digest = hash_password(base)
    assert verify_password(base, digest) is True
    assert verify_password(base[:72], digest) is True
    # Differing only past byte 72 — indistinguishable, by design rather than by accident.
    assert verify_password(base[:72] + "DIFFERENT", digest) is True


def test_multibyte_password_is_measured_in_bytes_not_characters():
    """The limit is 72 *bytes*. A 3-byte-per-character password hits it at 24
    characters, and truncating on a character boundary count would corrupt it."""
    plain = "パスワード1A"
    assert verify_password(plain, hash_password(plain)) is True


@pytest.mark.parametrize("value", [None, "", "plaintext"])
def test_is_bcrypt_digest_rejects_non_digests(value):
    assert is_bcrypt_digest(value) is False


# --- Migrated digests --------------------------------------------------------
#
# The roster seeder supports a `pre_hashed` entry so an account can be brought
# across with its digest rather than its password (LeapDesk's flag of the same
# name). Those digests come from PHP and carry the `$2y$` version letter, where
# Python's bcrypt writes `$2b$`. The letters mark the same algorithm — `$2y$` was
# PHP's marker after the 2011 sign-extension fix — so a digest written by one
# must verify under the other.
#
# Tested because the failure mode is silent and confusing: the account seeds
# without complaint, reports success, and the person simply cannot sign in.


def test_a_php_2y_digest_verifies():
    """The case that matters for a migrated account."""
    import bcrypt as _bcrypt

    digest = _bcrypt.hashpw(b"Known@123", _bcrypt.gensalt(rounds=4)).decode()
    php_style = "$2y$" + digest[4:]

    assert verify_password("Known@123", php_style) is True
    assert verify_password("Wrong@123", php_style) is False


def test_a_2y_digest_is_recognised_as_a_digest():
    """`is_bcrypt_digest` gates whether a stored value is treated as hashed at
    all, so a `$2y$` value it did not recognise would be read as plaintext."""
    import bcrypt as _bcrypt

    digest = _bcrypt.hashpw(b"Known@123", _bcrypt.gensalt(rounds=4)).decode()
    assert is_bcrypt_digest("$2y$" + digest[4:]) is True
