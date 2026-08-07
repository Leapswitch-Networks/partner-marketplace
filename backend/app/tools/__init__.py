"""Developer commands that are not part of the running application.

Kept out of `app/api` and `app/services` on purpose: nothing here is imported by a
request path, and nothing here should be. These are things a human or CI runs.
"""
