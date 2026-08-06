#!/usr/bin/env bash
# Clear a lockout on a local account.
#
#   ./scripts/unlock-user.sh                       # defaults to root@leapswitch.com
#   ./scripts/unlock-user.sh someone@example.com
#
# Local development only. It resets the failed-attempt counter and drops
# `locked_until` — it does NOT change the password and cannot reveal one, since
# passwords are bcrypt-hashed.
#
# `backend/.env` also raises MAX_FAILED_LOGIN_ATTEMPTS to 50 and drops the lockout
# to 1 minute locally, so you should rarely need this. Production keeps the
# 5-attempt / 15-minute defaults from app/core/config.py.
set -euo pipefail
cd "$(dirname "$0")/.."
EMAIL="${1:-root@leapswitch.com}"
docker compose exec -T db sh -lc \
  "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -c \
   \"UPDATE users SET failed_login_attempts = 0, locked_until = NULL \
     WHERE email = '${EMAIL}' \
     RETURNING email, status, failed_login_attempts, locked_until;\""
