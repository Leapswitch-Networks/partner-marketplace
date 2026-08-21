"""The enquiry state machine — TECH_DEBT PM-47.

No database. Every assertion here is about `enquiry_service`'s lifecycle table
and the public status mask, both of which are pure functions of a status string,
so this file runs in CI on the code alone. That matters: the rule it protects
(*never contradict a recorded timestamp*) is the reason § 16.1's trust measure can
be believed, and a test that only runs against a seeded install protects it only
where somebody remembered to seed one.

Every test below fails against the code as it was on 2026-08-20, when `set_status`
accepted any of the five statuses in any order.
"""

from __future__ import annotations

import pytest

from app.services import enquiry_service as svc


class _Enquiry:
    """The two attributes `public_status` reads. Not a database row."""

    def __init__(self, status: str) -> None:
        self.status = status


class TestTheTableItself:
    def test_every_status_the_enum_allows_has_a_row(self):
        """A status in the enum with no row is settable but has nowhere to go.

        `_ALL_STATUSES` is derived from the table, so a value added to the enum
        and not the table is rejected as unknown — which is safe, but silently
        makes the new status unreachable. This pins the two lists together.
        """
        from app.models.enquiry import EnquiryStatusEnum

        enum_values = set(EnquiryStatusEnum.enums)
        assert enum_values == set(svc._TRANSITIONS), (
            "the enquiry_status enum and _TRANSITIONS disagree. A value in the "
            "enum but not the table cannot be set at all; a value in the table "
            "but not the enum fails at the database with a cryptic error."
        )

    def test_no_status_may_become_itself(self):
        """Self-edges would make `set_status` ambiguous.

        Re-sending the current status is handled earlier, as an explicit no-op.
        A self-edge in the table would mean the same thing by accident, and the
        next reader could not tell whether idempotency was intended.
        """
        offenders = [status for status, targets in svc._TRANSITIONS.items() if status in targets]
        assert offenders == []

    def test_no_edge_points_at_a_status_that_does_not_exist(self):
        """A typo in a target is invisible until someone tries that move."""
        known = set(svc._TRANSITIONS)
        for status, targets in svc._TRANSITIONS.items():
            unknown = sorted(targets - known)
            assert unknown == [], f"{status} may become {unknown}, which does not exist"


class TestTheRuleTheTableEnforces:
    """Named for the rule, because that is what a future reader needs."""

    @pytest.mark.parametrize("earlier", ["NEW", "VIEWED"])
    def test_a_responded_enquiry_cannot_go_back_to_an_unanswered_state(self, earlier):
        """**The defect.** `RESPONDED -> NEW` was reachable and is a lie.

        `first_responded_at` is stamped and write-once, so an enquiry that has
        been answered carries proof of it for ever. A status saying otherwise puts
        the record in disagreement with its own timestamp, and § 16.1's measure is
        computed from the timestamp — so the inbox would show work outstanding
        that the metric counted as done.
        """
        assert earlier not in svc.allowed_transitions("RESPONDED")

    def test_an_outcome_cannot_return_to_the_inbox(self):
        """WON/LOST/CLOSED are conclusions, and reopening is not modelled.

        Deliberate: no call site asks for it. `add_buyer_message` says in as many
        words that a buyer writing again does not change the status, so there is
        no path that needs this edge — and an edge nothing uses is a claim the
        code cannot back up.
        """
        for outcome in ("WON", "LOST", "CLOSED"):
            reachable = svc.allowed_transitions(outcome)
            assert not (reachable & {"NEW", "VIEWED", "RESPONDED"}), (
                f"{outcome} can return to the inbox"
            )

    def test_one_outcome_can_be_corrected_into_another(self):
        """A mis-click must be fixable.

        These three do not contradict any timestamp, so changing between them is
        correcting a record rather than rewriting history — the distinction this
        whole table is drawn on.
        """
        assert "LOST" in svc.allowed_transitions("WON")
        assert "WON" in svc.allowed_transitions("LOST")
        assert "CLOSED" in svc.allowed_transitions("WON")

    def test_replying_straight_from_new_is_still_allowed(self):
        """Adding VIEWED must not force a partner to open before answering.

        `reply()` promotes NEW directly to RESPONDED, so forbidding that edge
        would put the service and the table in conflict.
        """
        assert "RESPONDED" in svc.allowed_transitions("NEW")


class TestSpam:
    @pytest.mark.parametrize(
        "current", ["NEW", "VIEWED", "RESPONDED", "WON", "LOST", "CLOSED"]
    )
    def test_it_is_reachable_from_every_other_state(self, current):
        """§ 19.9. Junk is recognisable at any point, including after a reply."""
        assert "SPAM" in svc.allowed_transitions(current)

    def test_it_is_not_offered_from_itself(self):
        """It is already spam; offering the move again is noise in the dropdown."""
        assert "SPAM" not in svc.allowed_transitions("SPAM")

    def test_a_false_positive_can_be_recovered(self):
        """One click marks a real enquiry as junk, so one click must undo it.

        Without this edge a mis-click destroys a genuine lead permanently, which
        is a worse defect than the one PM-47 set out to fix.
        """
        assert svc.allowed_transitions("SPAM") == frozenset({"NEW"})


class TestWhatTheBuyerIsTold:
    """`public_status` — the anonymous capability URL."""

    def test_spam_is_never_disclosed(self):
        """Two reasons, and the second is the stronger one.

        A spammer told their message was filtered has the feedback loop they need
        to iterate past the filter. And a *misclassified* real buyer would be told
        something worse than silence.
        """
        assert svc.public_status(_Enquiry("SPAM")) == "NEW"

    def test_viewed_is_not_disclosed_either(self):
        """Consistency with a decision already taken.

        `first_viewed_at` was deliberately kept off `PublicEnquiryStatus` — it was
        briefly added there by mistake, which would have told a buyer exactly when
        the partner opened their enquiry. Passing the status through would leak the
        same fact more coarsely, and the field would have been withheld for
        nothing.
        """
        assert svc.public_status(_Enquiry("VIEWED")) == "NEW"

    @pytest.mark.parametrize("status", ["NEW", "RESPONDED", "WON", "LOST", "CLOSED"])
    def test_everything_else_passes_through_unchanged(self, status):
        """The mask narrows the public surface and must never widen it."""
        assert svc.public_status(_Enquiry(status)) == status
