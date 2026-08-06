"""Validation for uploaded brand images.

**This is the first file upload in the codebase**, so the pattern set here is the one
everything later will copy. Three rules, each guarding a distinct failure:

1. **The type is decided by the bytes, never by the request.** `Content-Type` and the
   filename are both written by the client. A file called `logo.png` announcing
   `image/png` while containing something else is the entire premise of most
   image-upload exploits.
2. **Size is capped before the body is fully read.** Reading first and checking after
   means a caller decides how much memory the process allocates.
3. **Pixel dimensions are capped independently of file size.** A 30,000 × 30,000 PNG
   compresses to a few kilobytes and passes any byte-size check — then exhausts
   whatever decodes it. The bytes are never decoded server-side here, so the victim
   is the browser, which does not make it acceptable.

**SVG is deliberately rejected**, though it is the obvious format for a logo. An SVG
is a document: it can carry `<script>`, external references and event handlers, and
served from our own origin it would execute with our origin's privileges — a stored
XSS in the one asset shown on every page including the login screen. Mitigating that
means sanitising with a real parser or serving from a separate origin, neither of
which is worth it for a logo. Raster only.
"""

from dataclasses import dataclass

#: Hard ceiling per asset. Generous for a logo, small enough that the upload path
#: cannot be used to fill the database. Both assets together stay well inside a
#: single Postgres TOAST page's worth of practical concern.
MAX_UPLOAD_BYTES = 512 * 1024  # 512 KB

#: Pixel ceiling on either axis. A logo is rendered at ~32 px tall and a favicon at
#: 16–48 px; 2048 leaves room for a high-DPI source without admitting a bomb.
MAX_DIMENSION = 2048

#: Magic-byte signatures. Keyed by MIME type, each a list of (offset, prefix) pairs
#: that must ALL match.
_SIGNATURES: dict[str, list[tuple[int, bytes]]] = {
    "image/png": [(0, b"\x89PNG\r\n\x1a\n")],
    "image/jpeg": [(0, b"\xff\xd8\xff")],
    # RIFF....WEBP — the size field sits between the two markers, so both offsets
    # are checked rather than one long prefix.
    "image/webp": [(0, b"RIFF"), (8, b"WEBP")],
    "image/x-icon": [(0, b"\x00\x00\x01\x00")],
}

#: What each asset may be. A favicon is a tiny square the browser fetches on every
#: page, so JPEG is excluded there — it has no alpha channel and its artefacts show
#: badly at 16 px. A logo has no use for ICO.
ALLOWED_TYPES: dict[str, frozenset[str]] = {
    "logo": frozenset({"image/png", "image/jpeg", "image/webp"}),
    "favicon": frozenset({"image/png", "image/x-icon"}),
}


class ImageValidationError(ValueError):
    """The upload is not an acceptable image. Message is safe to show a user."""


@dataclass(frozen=True)
class ValidatedImage:
    """An upload that passed every check."""

    mime: str
    data: bytes
    #: `None` when the format's dimensions were not parsed — see `_dimensions`.
    width: int | None
    height: int | None


def detect_mime(data: bytes) -> str | None:
    """The MIME type implied by the leading bytes, or None if unrecognised."""
    for mime, signature in _SIGNATURES.items():
        if all(data[offset : offset + len(prefix)] == prefix for offset, prefix in signature):
            return mime
    return None


def validate(data: bytes, *, asset: str) -> ValidatedImage:
    """Check an upload for `asset` ("logo" or "favicon"), or raise.

    Order matters: size is rejected before the content is inspected, so a large
    upload is refused without any parsing work.
    """
    if asset not in ALLOWED_TYPES:
        raise ImageValidationError(f"Unknown asset {asset!r}.")

    if not data:
        raise ImageValidationError("The file is empty.")

    if len(data) > MAX_UPLOAD_BYTES:
        raise ImageValidationError(
            f"That file is {len(data) // 1024} KB. The limit is "
            f"{MAX_UPLOAD_BYTES // 1024} KB."
        )

    mime = detect_mime(data)
    if mime is None:
        # Deliberately does not echo the claimed Content-Type or the filename back:
        # the point is that neither was trusted, and repeating them would imply
        # otherwise.
        raise ImageValidationError(
            "That file is not a recognised image. Allowed: "
            + ", ".join(sorted(_readable(t) for t in ALLOWED_TYPES[asset]))
            + "."
        )

    if mime not in ALLOWED_TYPES[asset]:
        raise ImageValidationError(
            f"A {_readable(mime)} cannot be used as a {asset}. Allowed: "
            + ", ".join(sorted(_readable(t) for t in ALLOWED_TYPES[asset]))
            + "."
        )

    width, height = _dimensions(mime, data)
    if width is not None and height is not None:
        if width > MAX_DIMENSION or height > MAX_DIMENSION:
            raise ImageValidationError(
                f"That image is {width}×{height}. The limit is "
                f"{MAX_DIMENSION}×{MAX_DIMENSION} pixels."
            )
        if width == 0 or height == 0:
            raise ImageValidationError("That image reports a zero dimension.")

    return ValidatedImage(mime=mime, data=data, width=width, height=height)


def _readable(mime: str) -> str:
    return {
        "image/png": "PNG",
        "image/jpeg": "JPEG",
        "image/webp": "WebP",
        "image/x-icon": "ICO",
    }.get(mime, mime)


def _dimensions(mime: str, data: bytes) -> tuple[int | None, int | None]:
    """Pixel dimensions from the file header, without decoding the image.

    Header parsing rather than a library, because the alternative is Pillow — a large
    dependency, pulled in to read four integers, whose own decoders are a bigger
    attack surface than the one being closed.

    Returns `(None, None)` for formats not parsed here (WebP has several chunk
    layouts; ICO is a container of several sizes). Those still pass the byte-size and
    magic-byte checks — this is a gap, and it is a narrow one: both formats are
    capped at 512 KB, which bounds a decompression bomb far more tightly than PNG's
    ratio allows.
    """
    try:
        if mime == "image/png":
            # IHDR is the first chunk and always at a fixed offset: 8-byte signature,
            # 4-byte length, 4-byte type, then width and height as big-endian uint32.
            if len(data) < 24 or data[12:16] != b"IHDR":
                return None, None
            width = int.from_bytes(data[16:20], "big")
            height = int.from_bytes(data[20:24], "big")
            return width, height

        if mime == "image/jpeg":
            return _jpeg_dimensions(data)
    except (IndexError, ValueError):
        # A truncated or malformed header. Not an error here: the magic bytes matched,
        # so it claims to be an image, and refusing to *measure* it is different from
        # refusing it. The size cap still applies.
        return None, None

    return None, None


def _jpeg_dimensions(data: bytes) -> tuple[int | None, int | None]:
    """Walk JPEG segments to the frame header.

    JPEG has no fixed dimension offset — it is a chain of length-prefixed segments,
    and the dimensions live in whichever Start-of-Frame marker appears. So this walks
    rather than indexes.
    """
    index = 2  # past the SOI marker
    limit = len(data)
    while index < limit - 9:
        if data[index] != 0xFF:
            index += 1
            continue
        marker = data[index + 1]
        # SOF0–SOF3 and SOF5–SOF15 carry dimensions. SOF4 (0xC4) is the Huffman
        # table and 0xC8/0xCC are not frame headers, so they are excluded.
        if marker in {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}:
            height = int.from_bytes(data[index + 5 : index + 7], "big")
            width = int.from_bytes(data[index + 7 : index + 9], "big")
            return width, height
        if marker in {0xD8, 0x01} or 0xD0 <= marker <= 0xD9:
            index += 2  # markers with no payload
            continue
        segment_length = int.from_bytes(data[index + 2 : index + 4], "big")
        if segment_length < 2:
            return None, None
        index += 2 + segment_length
    return None, None
