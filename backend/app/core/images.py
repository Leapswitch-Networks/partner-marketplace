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

**SVG is accepted, and it is the one format that needs more than a signature check.**

This reverses an earlier decision to reject it outright. The reasoning that rejected
it was sound and is worth keeping in view: an SVG is a *document*, not a bitmap. It can
carry `<script>`, event handlers and external references, and served from our own
origin a malicious one is stored XSS in the single asset shown on every page including
the login screen.

What makes it tractable is a distinction the first pass missed:

  * an SVG loaded through `<img src="…">` — which is how every consumer here renders it
    — **cannot execute script in any current browser**
  * an SVG *navigated to directly*, as a top-level document, **can**

So the exposure is someone opening the asset URL, not the application rendering it.
Two independent controls close it, and both are applied because either alone is one
mistake away from failing:

1. **Rejected on upload, not sanitised.** `validate_svg` refuses anything carrying
   script, event handlers, external references, or a DOCTYPE. Refusing beats stripping:
   silently rewriting somebody's logo produces a file they did not upload, and a
   half-stripped SVG fails in ways nobody can debug.
2. **Served under a hard `Content-Security-Policy`** — see `api/settings.py`. Even a
   file that slipped past the check executes nothing, because the response itself
   forbids script and every external fetch.

Raster formats keep their magic-byte check and need none of this: a PNG cannot contain
a script.
"""

import re
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

#: MIME type for SVG. Not in `_SIGNATURES` because SVG has no magic bytes — it is XML,
#: so detection is structural rather than a byte prefix.
SVG_MIME = "image/svg+xml"

#: What each asset may be. A favicon is a tiny square the browser fetches on every
#: page, so JPEG is excluded there — it has no alpha channel and its artefacts show
#: badly at 16 px. A logo has no use for ICO.
#:
#: SVG is allowed for **both**: it is the natural format for a logo, and modern browsers
#: accept an SVG favicon. Note ICO/PNG remain the compatibility answer for favicons —
#: Safari only gained SVG favicon support recently — which is why the bundled default
#: stays an `.ico`.
ALLOWED_TYPES: dict[str, frozenset[str]] = {
    "logo": frozenset({"image/png", "image/jpeg", "image/webp", SVG_MIME}),
    "favicon": frozenset({"image/png", "image/x-icon", SVG_MIME}),
    # A partner's profile banner, added 2026-08-18.
    #
    # **No SVG.** A banner is photographic and always rendered large, so vector
    # buys nothing — and every SVG accepted is one more document that has to be
    # scanned and served under a restrictive policy. Narrowing the format list is
    # the cheapest security decision available here.
    "banner": frozenset({"image/png", "image/jpeg", "image/webp"}),
}

#: Substrings that disqualify an SVG. Matched case-insensitively against the whole
#: document, which is blunt on purpose: a permissive parser is exactly what an attacker
#: probes, and every one of these has no legitimate place in a logo.
#:
#: Each entry is here for a specific reason, not for symmetry:
_SVG_FORBIDDEN: tuple[tuple[str, str], ...] = (
    ("<script", "scripts"),
    # Embeds arbitrary HTML — the usual way script is smuggled past an element allowlist.
    ("<foreignobject", "embedded HTML"),
    ("<iframe", "frames"),
    ("<embed", "embedded objects"),
    ("<object", "embedded objects"),
    # SMIL animation can fire on load and set attributes, including href.
    ("<set", "SMIL animation"),
    ("<animate", "SMIL animation"),
    ("<handler", "event handlers"),
    # A DOCTYPE with an internal subset is the entry point for XXE and the
    # billion-laughs expansion. No logo needs one.
    ("<!doctype", "a DOCTYPE"),
    ("<!entity", "XML entities"),
    ("javascript:", "javascript: URLs"),
    # `data:text/html` in an href is a navigable document; `data:image` is harmless but
    # is not needed either, so the whole scheme is refused for simplicity.
    ("data:text/html", "data: HTML URLs"),
    # CSS that pulls in an external stylesheet.
    ("@import", "CSS imports"),
)

#: `on…=` event handler attributes. Regex rather than a substring list because the set
#: is open-ended — `onload`, `onclick`, `onmouseover`, `onbegin`, and whatever a future
#: specification adds. Any attribute whose name starts with `on` is refused.
_SVG_EVENT_ATTR = re.compile(r"<[^>]*\bon[a-z]+\s*=", re.IGNORECASE | re.DOTALL)

#: An `href`/`xlink:href`/`src` pointing anywhere but a same-document fragment. A logo
#: referencing an external URL would leak a request to a third party on every page view,
#: and `<use href="http://…">` has been an injection vector in its own right.
_SVG_EXTERNAL_REF = re.compile(
    r"""\b(?:xlink:href|href|src)\s*=\s*["']\s*(?!#)[^"']""", re.IGNORECASE
)


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
    """The MIME type implied by the content, or None if unrecognised.

    Raster formats are matched on their signature. SVG has none — it is XML — so it is
    matched structurally: an `<svg` root, possibly behind a BOM, an XML declaration or
    comments. Checked **last**, so a file that is genuinely a PNG is never re-read as
    text.
    """
    for mime, signature in _SIGNATURES.items():
        if all(data[offset : offset + len(prefix)] == prefix for offset, prefix in signature):
            return mime

    if _looks_like_svg(data):
        return SVG_MIME
    return None


def _looks_like_svg(data: bytes) -> bool:
    """True when the document's root element is `<svg`.

    Only the first kilobyte is examined, and it is decoded with `errors="replace"` — a
    file that is not text at all cannot match, and a mis-encoded one fails closed rather
    than raising. `<svg` is required to be the first *element*: allowing it anywhere
    would accept an HTML page with an inline SVG somewhere in the body.
    """
    head = data[:1024].decode("utf-8", errors="replace").lstrip("﻿").strip()
    # Step past an XML declaration and any leading comments.
    while True:
        if head.startswith("<?xml") and "?>" in head:
            head = head.split("?>", 1)[1].strip()
            continue
        if head.startswith("<!--") and "-->" in head:
            head = head.split("-->", 1)[1].strip()
            continue
        break
    return head.lower().startswith("<svg")


def validate_svg(data: bytes) -> None:
    """Raise `ImageValidationError` unless the SVG is safe to store and serve.

    **Refuses rather than sanitises.** Stripping would hand back a file the uploader did
    not choose, and a partially-stripped SVG breaks in ways nobody can debug from the
    rendered result. A clear "this contains scripts" is more useful than a silently
    mangled logo.

    This is one of two controls. The serve route applies a `Content-Security-Policy`
    that neutralises script even in a file that slipped past here — see
    `api/settings.py`. Neither is trusted alone.
    """
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError as exc:
        # An SVG must be valid text. Undecodable bytes behind an `<svg` prefix are not a
        # document we should be storing, whatever they are.
        raise ImageValidationError(
            "That SVG is not valid UTF-8 text."
        ) from exc

    lowered = text.lower()
    for needle, description in _SVG_FORBIDDEN:
        if needle in lowered:
            raise ImageValidationError(
                f"That SVG contains {description}, which is not allowed in an uploaded "
                "image. Export a flattened version, or upload a PNG."
            )

    if _SVG_EVENT_ATTR.search(text):
        raise ImageValidationError(
            "That SVG contains event-handler attributes, which are not allowed. "
            "Export a flattened version, or upload a PNG."
        )

    if _SVG_EXTERNAL_REF.search(text):
        raise ImageValidationError(
            "That SVG references an external file. Embed the artwork, or upload a PNG."
        )


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

    # SVG gets a content check that raster formats do not need, because it is the only
    # accepted format that is a document rather than a bitmap.
    if mime == SVG_MIME:
        validate_svg(data)

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
        SVG_MIME: "SVG",
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

        if mime == SVG_MIME:
            return _svg_dimensions(data)
    except (IndexError, ValueError):
        # A truncated or malformed header. Not an error here: the magic bytes matched,
        # so it claims to be an image, and refusing to *measure* it is different from
        # refusing it. The size cap still applies.
        return None, None

    return None, None


def _svg_dimensions(data: bytes) -> tuple[int | None, int | None]:
    """Declared width/height, or the `viewBox`, from the root element.

    Returns `(None, None)` rather than guessing when neither is present or the units are
    not pixels — an SVG with `width="100%"` has no intrinsic size, and inventing one to
    satisfy a cap would reject a perfectly good logo.

    **The dimension cap means less for SVG than for a bitmap.** A vector is resolution
    independent, so a large declared size is not a decompression bomb the way a
    30,000-pixel PNG is; the real defence for SVG is the 512 KB byte cap, since an
    expansion attack has to ship its own repeated markup.
    """
    head = data[:2048].decode("utf-8", errors="replace")
    match = re.search(r"<svg\b[^>]*>", head, re.IGNORECASE | re.DOTALL)
    if not match:
        return None, None
    root = match.group(0)

    def attr(name: str) -> float | None:
        found = re.search(rf'\b{name}\s*=\s*["\']\s*([0-9.]+)\s*(px)?\s*["\']', root, re.IGNORECASE)
        return float(found.group(1)) if found else None

    width, height = attr("width"), attr("height")
    if width is None or height is None:
        # Fall back to the viewBox's own width/height, which is where a responsive SVG
        # keeps its aspect ratio. `min-x min-y width height`.
        box = re.search(
            r'\bviewBox\s*=\s*["\']\s*[-0-9.]+[,\s]+[-0-9.]+[,\s]+([0-9.]+)[,\s]+([0-9.]+)',
            root,
            re.IGNORECASE,
        )
        if box:
            width, height = float(box.group(1)), float(box.group(2))

    if width is None or height is None:
        return None, None
    return int(width), int(height)


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
