"""Email attachment validation — the allowlist, the caps and the magic bytes.

The sibling of `test_image_validation.py`, and for the same reason: the declared
`Content-Type` on an upload is written by the client, so anything that trusts it
is trusting the caller. An attachment is the more exposed of the two upload
paths — a logo is rendered by our own page, an attachment is opened by whoever
receives the mail, on a machine we do not control.
"""

import pytest
from fastapi import HTTPException

from app.core import attachments as att

PDF = b"%PDF-1.7\n" + b"x" * 100
PNG = b"\x89PNG\r\n\x1a\n" + b"x" * 100
JPG = b"\xff\xd8\xff\xe0" + b"x" * 100
DOCX = b"PK\x03\x04" + b"x" * 100
DOC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + b"x" * 100


def reason(exc: pytest.ExceptionInfo) -> str:
    return exc.value.detail


class TestAcceptance:
    @pytest.mark.parametrize(
        "name,content,expected_type",
        [
            ("report.pdf", PDF, "application/pdf"),
            ("shot.png", PNG, "image/png"),
            ("photo.jpg", JPG, "image/jpeg"),
            ("photo.jpeg", JPG, "image/jpeg"),
            ("notes.doc", DOC, "application/msword"),
            ("sheet.xls", DOC, "application/vnd.ms-excel"),
        ],
    )
    def test_allowed_types_pass(self, name, content, expected_type):
        [result] = att.validate([(name, content)])
        assert result.filename == name
        assert result.content_type == expected_type
        assert result.content == content

    def test_zip_backed_office_formats_pass(self):
        results = att.validate([("a.docx", DOCX), ("b.xlsx", DOCX)])
        assert [r.subtype.split(".")[-1] for r in results] == ["document", "sheet"]

    def test_no_files_is_not_an_error(self):
        """Sending with nothing attached is the normal case."""
        assert att.validate([]) == []

    def test_extension_case_is_ignored(self):
        assert att.validate([("REPORT.PDF", PDF)])[0].content_type == "application/pdf"


class TestRejection:
    def test_disallowed_extension(self):
        with pytest.raises(HTTPException) as exc:
            att.validate([("payload.exe", b"MZ" + b"x" * 100)])
        assert exc.value.status_code == 422
        assert "not an allowed file type" in reason(exc)

    def test_renamed_executable_is_caught_by_its_bytes(self):
        """The whole point of checking magic bytes: the extension says PDF, the
        file is a Windows executable."""
        with pytest.raises(HTTPException) as exc:
            att.validate([("invoice.pdf", b"MZ\x90\x00" + b"x" * 100)])
        assert "not a valid PDF file" in reason(exc)

    def test_script_renamed_to_an_image_is_caught(self):
        with pytest.raises(HTTPException) as exc:
            att.validate([("logo.png", b"#!/bin/sh\nrm -rf /\n")])
        assert "not a valid PNG file" in reason(exc)

    def test_rejection_does_not_teach_what_the_check_looks_at(self):
        """The message names the file and the expected kind, never the bytes."""
        with pytest.raises(HTTPException) as exc:
            att.validate([("invoice.pdf", b"MZ\x90\x00")])
        assert "%PDF" not in reason(exc)

    def test_no_extension_at_all(self):
        with pytest.raises(HTTPException) as exc:
            att.validate([("README", PDF)])
        assert "not an allowed file type" in reason(exc)

    def test_empty_file(self):
        with pytest.raises(HTTPException) as exc:
            att.validate([("empty.pdf", b"")])
        assert "is empty" in reason(exc)

    def test_oversized_file(self):
        oversized = b"%PDF-" + b"x" * att.MAX_ATTACHMENT_BYTES
        with pytest.raises(HTTPException) as exc:
            att.validate([("huge.pdf", oversized)])
        assert "larger than 25 MB" in reason(exc)

    def test_too_many_files(self):
        with pytest.raises(HTTPException) as exc:
            att.validate([(f"f{i}.pdf", PDF) for i in range(att.MAX_ATTACHMENTS + 1)])
        assert "at most 5 files" in reason(exc)

    def test_total_size_cap_catches_what_the_per_file_cap_does_not(self):
        """Five files under the per-file limit can still be 125 MB. The
        reference caps each file and says nothing about the sum."""
        half = b"%PDF-" + b"x" * (att.MAX_ATTACHMENT_BYTES // 2)
        with pytest.raises(HTTPException) as exc:
            att.validate([(f"f{i}.pdf", half) for i in range(3)])
        assert "total more than 25 MB" in reason(exc)


class TestFilenames:
    def test_path_components_are_stripped(self):
        """The name is handed to the recipient's mail client, which does write
        to disk even though we never do."""
        assert att.safe_filename("../../etc/passwd") == "passwd"
        assert att.safe_filename("C:\\Users\\me\\report.pdf") == "report.pdf"

    def test_quotes_and_newlines_cannot_reach_a_header(self):
        cleaned = att.safe_filename('a"b\r\nContent-Type: text/html\r\n\r\n.pdf')
        assert '"' not in cleaned
        assert "\r" not in cleaned and "\n" not in cleaned

    def test_length_is_bounded(self):
        assert len(att.safe_filename("a" * 500 + ".pdf")) == 120

    def test_a_nameless_file_still_gets_a_name(self):
        assert att.safe_filename(None) == "attachment"
        assert att.safe_filename("   ") == "attachment"

    def test_a_stripped_name_is_still_validated(self):
        """`safe_filename` runs before the extension check, so a path that hides
        a disallowed extension behind a directory cannot slip through."""
        with pytest.raises(HTTPException):
            att.validate([("/tmp/report.pdf/evil.sh", PDF)])


class TestParityWithTheReference:
    def test_the_allowlist_matches_the_reference_exactly(self):
        """`mimes:pdf,doc,docx,xls,xlsx,jpg,jpeg,png` — no more, no less."""
        assert set(att.ALLOWED) == {
            "pdf", "doc", "docx", "xls", "xlsx", "jpg", "jpeg", "png",
        }

    def test_the_per_file_cap_matches_max_25600_kb(self):
        assert att.MAX_ATTACHMENT_BYTES == 25600 * 1024
