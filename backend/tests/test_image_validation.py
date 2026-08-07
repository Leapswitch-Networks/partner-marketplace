"""Upload validation — the first file upload in the codebase.

The pattern set in `core/images.py` is the one every later upload will copy, so it is
tested as a security boundary rather than as a helper. Three properties, each with its
own failure mode:

  * **the type comes from the bytes**, so a renamed or mislabelled file is refused
  * **size is capped**, so a caller cannot choose how much memory the process uses
  * **dimensions are capped independently**, because a decompression bomb passes any
    byte-size check

No database and no HTTP client: `validate` is a pure function over bytes, which is
what makes these assertions about the rules rather than about FastAPI.
"""

import pytest

from app.core.images import (
    ALLOWED_TYPES,
    MAX_DIMENSION,
    MAX_UPLOAD_BYTES,
    ImageValidationError,
    detect_mime,
    validate,
)

# --- Minimal real headers ---------------------------------------------------
#
# Hand-built rather than loaded from fixture files: the bytes that matter are the
# signature and the dimension fields, and constructing them makes the test state
# exactly which bytes it depends on.


def png(width: int = 64, height: int = 64, *, payload: int = 200) -> bytes:
    """A PNG signature plus a well-formed IHDR. Not a decodable image, by design —
    `validate` never decodes, so anything past the header is filler."""
    ihdr = (
        b"\x00\x00\x00\x0dIHDR"
        + width.to_bytes(4, "big")
        + height.to_bytes(4, "big")
        + b"\x08\x06\x00\x00\x00"
    )
    return b"\x89PNG\r\n\x1a\n" + ihdr + b"\x00" * payload


def jpeg(width: int = 64, height: int = 64) -> bytes:
    """SOI, an APP0 segment to be skipped, then an SOF0 carrying the dimensions.

    The skipped segment is the point: JPEG dimensions have no fixed offset, so this
    exercises the segment walk rather than a lucky index.
    """
    # APP0: marker, then a length that counts itself plus the 14-byte payload.
    app0 = b"\xff\xe0" + (16).to_bytes(2, "big") + b"JFIF\x00" + b"\x00" * 9
    # SOF0: marker, length, precision, HEIGHT then WIDTH (that order), components.
    sof0 = (
        b"\xff\xc0"
        + (17).to_bytes(2, "big")
        + b"\x08"
        + height.to_bytes(2, "big")
        + width.to_bytes(2, "big")
        + b"\x03"
        + b"\x00" * 9
    )
    # SOI is `ff d8`; the signature check wants `ff d8 ff`, which is SOI followed by
    # the first byte of the next marker — so APP0 must come directly after it.
    return b"\xff\xd8" + app0 + sof0 + b"\x00" * 64


def webp(payload: int = 100) -> bytes:
    return b"RIFF" + (payload + 4).to_bytes(4, "little") + b"WEBP" + b"\x00" * payload


def ico(payload: int = 100) -> bytes:
    return b"\x00\x00\x01\x00" + b"\x00" * payload


# --- Type detection ---------------------------------------------------------


@pytest.mark.parametrize(
    ("data", "expected"),
    [
        (png(), "image/png"),
        (jpeg(), "image/jpeg"),
        (webp(), "image/webp"),
        (ico(), "image/x-icon"),
    ],
)
def test_detects_each_allowed_format(data, expected):
    assert detect_mime(data) == expected


@pytest.mark.parametrize(
    "data",
    [
        b"",
        b"not an image at all",
        b"GIF89a" + b"\x00" * 32,
        b"%PDF-1.7\n" + b"\x00" * 32,
        b"MZ\x90\x00" + b"\x00" * 32,  # a Windows executable
        b"RIFF" + b"\x00" * 4 + b"WAVE",  # RIFF, but not WEBP
    ],
)
def test_rejects_anything_unrecognised(data):
    assert detect_mime(data) is None


def test_riff_requires_the_webp_marker_too():
    """Both offsets are checked, not just the leading `RIFF`.

    A `.wav` also begins `RIFF`, so matching only the first four bytes would accept
    an audio file as an image and store it with `Content-Type: image/webp`.
    """
    assert detect_mime(webp()) == "image/webp"
    assert detect_mime(b"RIFF" + b"\x00" * 4 + b"WAVE" + b"\x00" * 32) is None


# --- The core rule: bytes decide, not the request ---------------------------


def test_a_file_claiming_to_be_png_but_is_not_is_refused():
    """The premise of most image-upload exploits.

    Nothing here reads the filename or `Content-Type`, so a payload named `logo.png`
    and announced as `image/png` is judged purely on its content.
    """
    with pytest.raises(ImageValidationError, match="not a recognised image"):
        validate(b"<?php echo shell_exec($_GET['c']); ?>", asset="logo")


# --- SVG -------------------------------------------------------------------
#
# SVG is the one accepted format that is a *document* rather than a bitmap, so it is
# the only one where the bytes passing a signature check proves nothing. These tests
# are the first of the two controls that make accepting it safe; the second is the
# `Content-Security-Policy` on the serve route, which makes even a file that slipped
# past here inert.

#: The project's actual logo, verbatim from `logo/logo-master.svg`. Using the real
#: asset rather than a synthetic one means a rule tightened later cannot start
#: rejecting the logo this application ships with.
REAL_LOGO = b"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <rect x="0" y="0" width="1024" height="1024" rx="232.0" fill="#2f8a78"/>
  <g transform="translate(207.00,207.00) scale(1.17308)"><g fill="#ffffff">
      <rect x="0" y="0" width="152" height="520" rx="76"/>
      <rect x="212" y="0" width="308" height="232" rx="80"/>
      <rect x="212" y="288" width="308" height="232" rx="80"/>
    </g></g>
</svg>"""


def test_the_projects_own_logo_is_accepted_as_both_assets():
    """A guard against tightening the SVG rules until they reject our own artwork."""
    for asset in ("logo", "favicon"):
        image = validate(REAL_LOGO, asset=asset)
        assert image.mime == "image/svg+xml"
        assert (image.width, image.height) == (1024, 1024)
        assert image.data == REAL_LOGO, "bytes must be stored unmodified, never rewritten"


def test_svg_is_detected_without_magic_bytes():
    """SVG is XML, so detection is structural. It must be tried LAST.

    A PNG happens to be binary and could never match, but checking SVG first would mean
    re-reading every raster upload as text for nothing.
    """
    assert detect_mime(REAL_LOGO) == "image/svg+xml"
    assert detect_mime(b'<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"/>') == "image/svg+xml"
    assert detect_mime(b'\xef\xbb\xbf<svg xmlns="http://www.w3.org/2000/svg"/>') == "image/svg+xml"
    assert detect_mime(b'<!-- exported --><svg xmlns="http://www.w3.org/2000/svg"/>') == "image/svg+xml"


def test_an_html_page_containing_an_svg_is_not_an_svg():
    """`<svg` must be the ROOT element.

    Accepting it anywhere in the document would admit an HTML page that happens to
    contain an inline SVG — which is a navigable document, and the whole thing this
    guards against.
    """
    assert detect_mime(b"<html><body><svg xmlns='http://www.w3.org/2000/svg'></svg></body></html>") is None


#: Every payload here was run against the implementation; all eleven are refused.
#: Named so a failure says which attack got through.
SVG_ATTACKS = [
    pytest.param(
        b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(document.cookie)</script></svg>',
        "scripts", id="inline-script",
    ),
    pytest.param(
        b'<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect width="1" height="1"/></svg>',
        "event-handler", id="onload-on-root",
    ),
    pytest.param(
        b'<svg xmlns="http://www.w3.org/2000/svg"><rect onmouseover="alert(1)" width="1" height="1"/></svg>',
        "event-handler", id="onmouseover-on-child",
    ),
    pytest.param(
        b'<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><body onload="alert(1)"/></foreignObject></svg>',
        "embedded HTML", id="foreignobject",
    ),
    pytest.param(
        b'<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><rect/></a></svg>',
        "javascript:", id="javascript-url",
    ),
    pytest.param(
        b'<svg xmlns="http://www.w3.org/2000/svg"><use href="https://evil.test/x.svg#a"/></svg>',
        "external file", id="external-use",
    ),
    pytest.param(
        b'<svg xmlns="http://www.w3.org/2000/svg"><image href="http://evil.test/track.png"/></svg>',
        "external file", id="external-image-beacon",
    ),
    pytest.param(
        b'<svg xmlns="http://www.w3.org/2000/svg"><animate attributeName="href" values="javascript:alert(1)"/></svg>',
        "SMIL", id="smil-animate",
    ),
    pytest.param(
        b'<svg xmlns="http://www.w3.org/2000/svg"><style>@import url(//evil.test/x.css);</style></svg>',
        "CSS imports", id="css-import",
    ),
]


@pytest.mark.parametrize(("payload", "expected_reason"), SVG_ATTACKS)
def test_malicious_svg_is_refused(payload, expected_reason):
    with pytest.raises(ImageValidationError) as excinfo:
        validate(payload, asset="logo")
    assert expected_reason in str(excinfo.value)


@pytest.mark.parametrize(("payload", "_reason"), SVG_ATTACKS)
def test_malicious_svg_is_refused_for_favicons_too(payload, _reason):
    """The favicon path must not be the weaker one. It is a different allowlist, so it
    is a different code path, so it gets its own assertion."""
    with pytest.raises(ImageValidationError):
        validate(payload, asset="favicon")


def test_an_entity_expansion_attack_is_refused():
    """Billion laughs / XXE. Refused before the SVG rules even run.

    A leading `<!DOCTYPE` means `<svg` is not the root element, so `detect_mime` returns
    None and the file is rejected as unrecognised. The `<!doctype` entry in the
    forbidden list is therefore belt-and-braces for a DOCTYPE appearing later — which is
    not valid XML anyway. Asserted here so the *outcome* is pinned even if the layer
    that produces it changes.
    """
    payload = (
        b'<?xml version="1.0"?><!DOCTYPE s [<!ENTITY a "aaaa">]>'
        b'<svg xmlns="http://www.w3.org/2000/svg"><text>&a;</text></svg>'
    )
    with pytest.raises(ImageValidationError):
        validate(payload, asset="logo")


def test_svg_refusals_do_not_silently_strip():
    """Refusing beats sanitising, and that is a product decision as much as a security one.

    A stripped SVG is a file the uploader did not choose, and it breaks in ways nobody
    can debug from the rendered result. So `validate` raises rather than returning
    altered bytes — asserted by there being no success path to return them through.
    """
    payload = b'<svg xmlns="http://www.w3.org/2000/svg"><script>x</script><rect/></svg>'
    with pytest.raises(ImageValidationError):
        validate(payload, asset="logo")


def test_undecodable_bytes_behind_an_svg_prefix_are_refused():
    """An SVG must be valid text. Invalid UTF-8 is not a document worth storing."""
    with pytest.raises(ImageValidationError, match="UTF-8"):
        validate(b'<svg xmlns="http://www.w3.org/2000/svg">\xff\xfe\x00</svg>', asset="logo")


def test_svg_dimensions_fall_back_to_the_viewbox():
    """A responsive SVG has no width/height, only a viewBox. It must still be measured."""
    responsive = b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240"/>'
    image = validate(responsive, asset="logo")
    assert (image.width, image.height) == (320, 240)


def test_svg_with_no_intrinsic_size_is_accepted_unmeasured():
    """`width="100%"` has no pixel size. Inventing one to satisfy the cap would reject a
    perfectly good logo, so it resolves to None and only the byte cap applies."""
    image = validate(b'<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"/>', asset="logo")
    assert image.width is None and image.height is None


def test_error_message_does_not_echo_the_rejected_content():
    """The message must not repeat what the client sent.

    Echoing a claimed type or filename back would imply it was consulted, and
    reflecting attacker-controlled bytes into a message that a UI renders is its own
    small hazard.
    """
    payload = b"<script>alert('xss')</script>" + b"\x00" * 64
    with pytest.raises(ImageValidationError) as excinfo:
        validate(payload, asset="logo")
    assert "script" not in str(excinfo.value)
    assert "alert" not in str(excinfo.value)


# --- Per-asset allowlists ---------------------------------------------------


def test_jpeg_is_allowed_as_a_logo_but_not_as_a_favicon():
    """JPEG has no alpha and its artefacts show badly at 16px."""
    assert validate(jpeg(), asset="logo").mime == "image/jpeg"
    with pytest.raises(ImageValidationError, match="cannot be used as a favicon"):
        validate(jpeg(), asset="favicon")


def test_ico_is_allowed_as_a_favicon_but_not_as_a_logo():
    assert validate(ico(), asset="favicon").mime == "image/x-icon"
    with pytest.raises(ImageValidationError, match="cannot be used as a logo"):
        validate(ico(), asset="logo")


def test_png_is_allowed_for_both():
    assert validate(png(), asset="logo").mime == "image/png"
    assert validate(png(), asset="favicon").mime == "image/png"


def test_unknown_asset_name_is_refused():
    """Defence in depth. The route already constrains this with a `Literal`, but the
    service must not depend on its caller having done so."""
    with pytest.raises(ImageValidationError, match="Unknown asset"):
        validate(png(), asset="banner")


def test_every_allowlisted_type_is_actually_detectable():
    """Guards a typo in `ALLOWED_TYPES` that would silently forbid a format.

    A MIME string listed as allowed but never produced by `detect_mime` is a format
    the code believes it accepts and always rejects.
    """
    detectable = {detect_mime(d) for d in (png(), jpeg(), webp(), ico(), REAL_LOGO)}
    for asset, allowed in ALLOWED_TYPES.items():
        assert allowed <= detectable, f"{asset} allows a type nothing can detect"


# --- Size ------------------------------------------------------------------


def test_empty_upload_is_refused():
    with pytest.raises(ImageValidationError, match="empty"):
        validate(b"", asset="logo")


def test_oversized_upload_is_refused_and_names_the_limit():
    oversized = png(payload=MAX_UPLOAD_BYTES + 1000)
    assert len(oversized) > MAX_UPLOAD_BYTES
    with pytest.raises(ImageValidationError) as excinfo:
        validate(oversized, asset="logo")
    assert str(MAX_UPLOAD_BYTES // 1024) in str(excinfo.value)


def test_size_is_checked_before_the_content():
    """Order matters: a large upload is refused without any parsing work.

    Asserted via the message — an oversized non-image must report the *size*
    problem, which proves the cheap check ran first.
    """
    with pytest.raises(ImageValidationError) as excinfo:
        validate(b"\x00" * (MAX_UPLOAD_BYTES + 1), asset="logo")
    assert "limit is" in str(excinfo.value)


def test_a_file_exactly_at_the_limit_is_accepted():
    """The boundary is inclusive. Off-by-one here rejects a legitimate upload."""
    exact = png(payload=0)
    exact = exact + b"\x00" * (MAX_UPLOAD_BYTES - len(exact))
    assert len(exact) == MAX_UPLOAD_BYTES
    assert validate(exact, asset="logo").mime == "image/png"


# --- Dimensions ------------------------------------------------------------


def test_png_dimensions_are_read_from_the_header():
    image = validate(png(320, 240), asset="logo")
    assert (image.width, image.height) == (320, 240)


def test_jpeg_dimensions_are_found_by_walking_segments():
    """The APP0 segment must be skipped to reach SOF0."""
    image = validate(jpeg(800, 600), asset="logo")
    assert (image.width, image.height) == (800, 600)


def test_a_decompression_bomb_is_refused_despite_a_tiny_file():
    """The check byte-size cannot make.

    A 30,000 x 30,000 PNG is a few hundred bytes on the wire and would exhaust
    whatever decodes it. Nothing decodes it here, so the victim is the browser —
    which does not make it acceptable to store and serve.
    """
    bomb = png(30000, 30000)
    assert len(bomb) < 1024, "the point is that it is small"
    with pytest.raises(ImageValidationError) as excinfo:
        validate(bomb, asset="logo")
    assert str(MAX_DIMENSION) in str(excinfo.value)


def test_a_zero_dimension_is_refused():
    with pytest.raises(ImageValidationError, match="zero dimension"):
        validate(png(0, 64), asset="logo")


def test_the_dimension_boundary_is_inclusive():
    assert validate(png(MAX_DIMENSION, MAX_DIMENSION), asset="logo").width == MAX_DIMENSION
    with pytest.raises(ImageValidationError):
        validate(png(MAX_DIMENSION + 1, 10), asset="logo")


def test_formats_without_dimension_parsing_still_pass_the_other_checks():
    """WebP and ICO report `None` dimensions — a documented gap, not a failure.

    They must still be accepted (they are valid formats) and still be size-capped,
    which is what bounds the risk the dimension check would otherwise cover.
    """
    for data, asset in ((webp(), "logo"), (ico(), "favicon")):
        image = validate(data, asset=asset)
        assert image.width is None and image.height is None

    with pytest.raises(ImageValidationError):
        validate(webp(payload=MAX_UPLOAD_BYTES), asset="logo")


def test_a_truncated_header_is_accepted_rather_than_measured():
    """Refusing to *measure* an image is different from refusing it.

    The magic bytes matched, so it claims to be a PNG; an unparseable IHDR yields
    `None` dimensions and the size cap still applies. Erroring here would reject
    valid-but-unusual files for no security gain.
    """
    truncated = b"\x89PNG\r\n\x1a\n" + b"\x00" * 8
    image = validate(truncated, asset="logo")
    assert image.width is None and image.height is None


def test_validated_image_carries_the_original_bytes_unmodified():
    """Nothing is re-encoded, so what is stored is what was uploaded.

    Worth asserting: a future "optimise on upload" step would change this, and the
    stored bytes are served verbatim with the detected MIME.
    """
    data = png(100, 50)
    assert validate(data, asset="logo").data == data
