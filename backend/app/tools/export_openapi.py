"""Write the OpenAPI document to a file. The source of the frontend's types.

    python -m app.tools.export_openapi            # → backend/openapi.json
    python -m app.tools.export_openapi --check    # exit 1 if the file is stale

**No server and no database.** `app.openapi()` builds the document from the route
definitions, so this needs the app *imported*, not running — which is what lets CI
regenerate and compare it without standing up Postgres. Importing `app.main` does
require `DATABASE_URL` and `SECRET_KEY` to be present, but never connects.

**Why a committed file rather than fetching `/openapi.json` in the build.** The
frontend's types are generated from this, and generation has to be reproducible from
a checkout alone: a build that reaches for a running backend fails on a laptop with
the stack down, and worse, silently generates types from whatever version happens to
be running. The file is the contract, reviewed in the diff like any other.

`--check` is what makes it trustworthy. Without it the committed file drifts from the
routes the moment someone adds an endpoint and forgets to regenerate — and stale
generated types are worse than no generated types, because they look authoritative.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys

# `backend/openapi.json` — resolved from this file rather than the working directory,
# so it lands in the same place however the command is invoked.
OUTPUT = pathlib.Path(__file__).resolve().parents[2] / "openapi.json"


def build() -> str:
    """The document as it will be written: sorted keys, one trailing newline.

    Sorted and indented deliberately. FastAPI's dict ordering is stable in practice
    but not guaranteed across versions, and an unsorted dump would produce diff noise
    that makes `--check` cry wolf — at which point somebody adds `|| true` to the CI
    step and the guard is gone.
    """
    from app.main import app

    return json.dumps(app.openapi(), indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.tools.export_openapi")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Do not write. Exit 1 if the committed file differs from the routes.",
    )
    args = parser.parse_args(argv)

    current = build()

    if args.check:
        if not OUTPUT.exists():
            print(f"[openapi] {OUTPUT.name} is missing. Run without --check.", file=sys.stderr)
            return 1
        if OUTPUT.read_text() != current:
            print(
                f"[openapi] {OUTPUT.name} is out of date — the routes have changed.\n"
                "[openapi] Run `python -m app.tools.export_openapi`, then regenerate the\n"
                "[openapi] frontend types with `npm run codegen:api`, and commit both.",
                file=sys.stderr,
            )
            return 1
        print(f"[openapi] {OUTPUT.name} matches the routes")
        return 0

    OUTPUT.write_text(current)
    document = json.loads(current)
    operations = sum(
        1
        for path in document["paths"].values()
        for method in path
        if method in {"get", "post", "put", "patch", "delete"}
    )
    print(f"[openapi] wrote {OUTPUT.name}: {operations} operations across {len(document['paths'])} paths")
    return 0


if __name__ == "__main__":
    sys.exit(main())
