"""The AI assistant (LeapDesk parity Module 9).

Four pieces, deliberately separated so the dangerous one is small enough to read
in full:

* `tools.py` — what the assistant may do, and the five controls on doing it
* `registry.py` — which of those tools a given user's assistant is even told about
* `prompt.py` — the instructions, rebuilt per request from that user's permissions
* `guard.py` — a deterministic pass over every reply before anyone reads it
* `client.py` — the Anthropic call itself

Orchestration and persistence live in `app/services/ai_service.py`, so this
package holds no session lifecycle and no HTTP concerns.
"""
