#!/usr/bin/env sh
#
# Dev entrypoint for the containerised backend.
#
# Why this script exists: app/core/config.py reads DATABASE_URL from
# backend/.env, which points at localhost:5434 — correct when uvicorn runs on
# the host, wrong inside a container where Postgres is a sibling compose
# service reachable as db:5432.
#
# It rewrites ONLY the host:port of that URL and leaves the credentials byte-for-byte
# intact. That matters: POSTGRES_PASSWORD contains '@' and '#', so DATABASE_URL
# carries it percent-encoded. Rebuilding the URL from POSTGRES_USER /
# POSTGRES_PASSWORD inside docker-compose.yml would yield an unparseable URL,
# and hardcoding the encoded form would commit a secret to a public repo.
# Rewriting in place avoids both problems.
set -e

DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"

if [ -n "${DATABASE_URL:-}" ]; then
  DATABASE_URL="$(DB_HOST="$DB_HOST" DB_PORT="$DB_PORT" python - <<'PY'
import os
import sys
from urllib.parse import urlsplit, urlunsplit

url = urlsplit(os.environ["DATABASE_URL"])

# Re-emit userinfo exactly as it arrived — still percent-encoded, never decoded.
userinfo = ""
if "@" in url.netloc:
    userinfo = url.netloc.rsplit("@", 1)[0] + "@"

netloc = "{}{}:{}".format(userinfo, os.environ["DB_HOST"], os.environ["DB_PORT"])
sys.stdout.write(urlunsplit((url.scheme, netloc, url.path, url.query, url.fragment)))
PY
)"
  export DATABASE_URL
fi

# compose gates this container on the db healthcheck already, but the wait makes
# `docker compose run backend ...` safe to use on its own too.
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -q; do
  echo "entrypoint: waiting for postgres at $DB_HOST:$DB_PORT ..."
  sleep 1
done

exec "$@"
