import logging

from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger("app.config")

#: Distinctive placeholder strings, matched as a SUBSTRING.
#:
#: Substring rather than equality because the length floor is trivially defeated by
#: repetition: `"changeme" * 4` is 32 characters and would otherwise pass both
#: rules. Found by the test written for the exact-match version — see
#: tests/test_config_environment.py.
#:
#: Everything here is long and distinctive enough that a random key containing one
#: by chance is not a real risk (for a 48-character urlsafe key, the odds of
#: "changeme" appearing are around 1 in 10^12). Short generic words like "dev" go
#: in the exact-match set below, because a random key containing "dev" is roughly
#: 1 in 6000 — rare, but a false refusal is a confusing outage.
_PLACEHOLDER_SUBSTRINGS = (
    "changeme",
    "change-me",
    "change_me",
    "secretkey",
    "secret-key",
    "secret_key",
    "supersecret",
    "super-secret",
    "yoursecret",
    "your-secret",
    "insecure",
    "placeholder",
    "example",
    "todo",
)

#: Placeholders too short or too generic to match as a substring, so matched whole.
_PLACEHOLDER_EXACT = frozenset(
    {"secret", "password", "key", "dev", "development", "test", "testing", "local"}
)

#: Below this a key is brute-forceable, and a forged token is a forged token for
#: *any* account. HS256 keys should be at least as long as the digest.
_MIN_SECRET_KEY_LENGTH = 32

#: A key built by repeating a short string clears the length floor while carrying
#: almost none of the entropy the floor is there to guarantee. `"changeme" * 4` has
#: 8 distinct characters in 32; `secrets.token_urlsafe(48)` has around 35. Twelve
#: sits far below any real generated key and far above any repeated word.
_MIN_SECRET_KEY_DISTINCT_CHARS = 12


class ConfigurationError(RuntimeError):
    """An environment is configured in a way that must not be allowed to serve.

    Raised at import time, deliberately. A process that starts and then leaks is
    worse than one that never starts, and a warning in a startup log is read once
    — by whoever deployed, if they scroll.
    """


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- Environment --------------------------------------------------------
    # The field that lets the code object to its own configuration. Before this
    # existed, every rule in DEPLOYMENT.md § 0 was a thing a human had to
    # remember, and the register's own history shows how that goes: PM-2 and PM-4
    # sat in the blocker list as live 🔴 items while the code was already correct,
    # and § 0 listed five resolved items as blockers. Prose about configuration
    # drifts from configuration; an assertion cannot. See TECH_DEBT PM-37.
    #
    # `development` is the default so nothing local changes. Set APP_ENV=production
    # and the validator below refuses to boot on any unsafe default.
    APP_ENV: str = "development"

    # --- Database -----------------------------------------------------------
    DATABASE_URL: str

    # --- JWT ----------------------------------------------------------------
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # --- Cookies ------------------------------------------------------------
    # COOKIE_SECURE must be True anywhere the app is served over HTTPS. It is
    # False by default so local HTTP development works; see TECH_DEBT PM-2.
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"

    # --- Password hashing ---------------------------------------------------
    # 12 matches LeapDesk's BCRYPT_ROUNDS. Raising this slows every login and
    # every registration; bcrypt cost is exponential.
    BCRYPT_ROUNDS: int = 12
    PASSWORD_MIN_LENGTH: int = 8

    # --- Login throttling ---------------------------------------------------
    MAX_FAILED_LOGIN_ATTEMPTS: int = 5
    ACCOUNT_LOCKOUT_MINUTES: int = 15

    # --- HTTP rate limiting (PM-26) -----------------------------------------
    # Per-IP, which is the axis account lockout cannot cover: one attempt each
    # against a thousand accounts never trips a lockout. See core/rate_limit.py
    # for the tiers and for why the counters being per-process matters.
    #
    # Switchable because a load test or a bulk import wants it off, and because
    # once a reverse proxy does the limiting this becomes duplication.
    RATE_LIMIT_ENABLED: bool = True
    # Whether to believe `X-Forwarded-For`. Clients write that header, so trusting
    # it without a proxy that overwrites it hands every caller a free bypass of
    # the limits below — measured, not hypothetical: see get_client_ip. Enable
    # this only in the same change that puts a reverse proxy in front.
    TRUST_PROXY_HEADERS: bool = False
    # Credential and token endpoints. 10/minute is unremarkable for a person
    # typing a password and expensive for anyone spraying.
    RATE_LIMIT_SENSITIVE_MAX_REQUESTS: int = 10
    RATE_LIMIT_SENSITIVE_WINDOW_SECONDS: int = 60
    # The rest of /api/auth/*. Cannot be as tight as the above: the frontend
    # reads /api/auth/me on navigation, so a tight limit here breaks ordinary
    # browsing rather than an attack.
    RATE_LIMIT_AUTH_MAX_REQUESTS: int = 60
    RATE_LIMIT_AUTH_WINDOW_SECONDS: int = 60
    # Everything else. High enough that a dashboard loading several lists in
    # parallel is nowhere near it.
    RATE_LIMIT_DEFAULT_MAX_REQUESTS: int = 300
    RATE_LIMIT_DEFAULT_WINDOW_SECONDS: int = 60

    # --- Signup policy ------------------------------------------------------
    # Staff are domain-gated and may use Google SSO. Anyone else may register
    # with credentials as a partner and lands INACTIVE pending approval.
    #
    # Comma-separated so one env var can carry several domains.
    STAFF_EMAIL_DOMAINS: str = "leapswitch.com"
    ALLOW_PARTNER_SELF_REGISTRATION: bool = True
    # Every new account starts INACTIVE. An admin must approve before first
    # login. This is the single most important control inherited from LeapDesk —
    # a valid Google account alone grants nothing.
    NEW_USER_DEFAULT_STATUS: str = "INACTIVE"

    # --- Google OAuth -------------------------------------------------------
    # Left blank by default: Google SSO self-disables when unconfigured rather
    # than erroring, so the app runs without credentials.
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = ""

    # --- Email verification (PM-35) -----------------------------------------
    # 24 hours rather than the 1 hour a password reset gets. A reset link is a
    # live credential and should be short-lived; a verification link proves an
    # address and grants nothing on its own, so the balance tips towards the user
    # who opens their email the next morning.
    EMAIL_VERIFICATION_TTL_HOURS: int = 24
    # Whether approving an account requires its address to be verified first.
    # On by default: approving an unverified account activates one whose owner may
    # not control the address, and password reset then delivers to that address.
    # An admin who has vouched out-of-band can still override per request.
    REQUIRE_VERIFIED_EMAIL_FOR_APPROVAL: bool = True

    # --- Audit log retention (PM-32) ------------------------------------------
    # A DEFAULT for whoever runs the purge, not an active policy — nothing calls it
    # on a schedule, because there is no scheduler and because how long
    # who-did-what is kept is a decision rather than a constant. Two years is a
    # common floor for access records; change it deliberately.
    ACTIVITY_LOG_RETENTION_DAYS: int = 730

    # --- Refresh-token rotation (PM-31) --------------------------------------
    # How long the immediately-superseded refresh token is still honoured. Without
    # a window, two browser tabs refreshing at the same instant would look like a
    # replay and kill the session — signing out a legitimate user for having two
    # tabs open. Short enough that an attacker gains only these seconds on a token
    # they would already have to hold.
    REFRESH_ROTATION_GRACE_SECONDS: int = 30

    # --- Two-factor auth (PM-34) --------------------------------------------
    # Steps of ±30s accepted either side of now. LeapDesk leaves Fortify's
    # `window` commented out, which means its default of 0 — exact match only.
    # 1 is chosen here instead: a phone clock a few seconds out is common, and the
    # cost is that a code stays valid for about 90 seconds rather than 30. Codes
    # are single-use in practice because the challenge token is consumed.
    TWO_FACTOR_WINDOW: int = 1
    TWO_FACTOR_RECOVERY_CODE_COUNT: int = 8
    # How long the intermediate token from a successful password check stays valid
    # while the user fetches a code. Long enough to open an authenticator app,
    # short enough that a leaked challenge token is nearly worthless.
    TWO_FACTOR_CHALLENGE_TTL_MINUTES: int = 5
    # Issuer shown in the authenticator app next to the account name.
    TWO_FACTOR_ISSUER: str = "Partner Marketplace"

    # --- Password confirmation ----------------------------------------------
    # How long a re-entered password authorises sensitive actions for. Laravel's
    # default is 3 hours; kept, so the two projects behave the same.
    PASSWORD_CONFIRMATION_TIMEOUT_MINUTES: int = 180

    # --- Password OTP recovery (settings page) -------------------------------
    # A signed-in user who cannot supply their current password proves ownership
    # of their email with a 6-digit code instead. All three values match LeapDesk
    # so the two behave identically.
    PASSWORD_OTP_TTL_MINUTES: int = 10
    # Throttles resends. LeapDesk enforces this in the controller by looking for a
    # code created in the last minute; here it is derived from the stored expiry.
    PASSWORD_OTP_RESEND_COOLDOWN_SECONDS: int = 60
    # How long proving email ownership authorises a password change for. Kept equal
    # to the code's own TTL: the grace should not outlive the evidence for it.
    PASSWORD_OTP_GRACE_MINUTES: int = 10

    # --- Security headers (PM-33) -------------------------------------------
    # HSTS is off by default and deliberately NOT tied to COOKIE_SECURE. The two
    # answer different questions: whether cookies require TLS, versus whether
    # every browser that has seen this host should refuse plain HTTP to it for a
    # year. Enabling it against a host without a valid certificate is not a
    # warning, it is an outage no server-side change can clear.
    HSTS_ENABLED: bool = False
    HSTS_MAX_AGE_SECONDS: int = 31536000  # one year, matching LeapDesk
    HSTS_INCLUDE_SUBDOMAINS: bool = True
    # Preload submits the domain to a browser-shipped list, which is effectively
    # irreversible. Opt in only once the domain is settled.
    HSTS_PRELOAD: bool = False

    # --- Email (PM-27) ------------------------------------------------------
    # `console` logs the message instead of sending it, so local development needs
    # no SMTP server and the accept/reset link is visible in the backend logs.
    # `smtp` sends for real.
    #
    # `console` is the default rather than `smtp` deliberately: an unconfigured
    # `smtp` backend fails every send, while an unconfigured `console` backend
    # works. The cost of guessing wrong should be "the link is in the log", not
    # "nobody can be invited". A deployed environment MUST set this to `smtp` —
    # a reset link in a log file is a working credential for anyone who can read
    # logs. Listed in DEPLOYMENT § 0.
    MAIL_BACKEND: str = "console"
    MAIL_FROM: str = "no-reply@leapswitch.com"
    MAIL_FROM_NAME: str = "Partner Marketplace"
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    # 587 with STARTTLS is the common case; 465 wants SSL from the first byte.
    SMTP_USE_TLS: bool = True
    SMTP_USE_SSL: bool = False
    # Without a timeout, a silent relay blocks the worker until the client gives
    # up, which on a synchronous stack means one fewer request served.
    SMTP_TIMEOUT_SECONDS: int = 10

    # --- Logging (PM-10) ----------------------------------------------------
    # `console` is readable by a human; `json` is one object per line for an
    # aggregator. Deployed environments want json — grep does not survive
    # multi-line tracebacks.
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "console"
    # Echoed back on every response and accepted on the way in, so a request can
    # be followed across the proxy, the API and the logs. Inbound values are
    # validated before use: see core/logging.py.
    LOG_REQUEST_ID_HEADER: str = "X-Request-ID"

    # --- Frontend -----------------------------------------------------------
    # Where OAuth hands the browser back to, and the CORS allowlist. Comma
    # separated. Configurable so deploying never needs a code edit (PM-9).
    FRONTEND_URL: str = "http://localhost:3001"
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001"

    # --- Derived helpers ----------------------------------------------------

    @property
    def is_production(self) -> bool:
        return self.APP_ENV.strip().lower() == "production"

    @property
    def is_development(self) -> bool:
        return self.APP_ENV.strip().lower() == "development"

    @property
    def staff_domains(self) -> list[str]:
        return [d.strip().lower().lstrip("@") for d in self.STAFF_EMAIL_DOMAINS.split(",") if d.strip()]

    @property
    def allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def google_oauth_configured(self) -> bool:
        return bool(self.GOOGLE_CLIENT_ID and self.GOOGLE_CLIENT_SECRET and self.GOOGLE_REDIRECT_URI)

    def is_staff_email(self, email: str) -> bool:
        """True when the address belongs to one of the configured staff domains."""
        addr = email.strip().lower()
        return any(addr.endswith("@" + domain) for domain in self.staff_domains)

    # --- Environment safety (PM-37) -----------------------------------------

    def model_post_init(self, _context: object) -> None:
        """Refuse to serve a production environment on a development default.

        Every default in this file is individually correct for local development
        and individually dangerous in production. That is not a flaw in the
        defaults — `COOKIE_SECURE=False` is the only way local HTTP works, and
        `MAIL_BACKEND=console` is deliberately the default so that guessing wrong
        costs "the link is in the log" rather than "nobody can ever be invited".

        The flaw was that nothing knew which environment it was in, so nothing
        could object. This does.
        """
        problems, warnings = self.audit_environment()

        for warning in warnings:
            logger.warning("configuration warning: %s", warning)

        if problems:
            numbered = "\n".join(f"  {i}. {p}" for i, p in enumerate(problems, 1))
            raise ConfigurationError(
                f"APP_ENV={self.APP_ENV} but {len(problems)} setting(s) are unsafe:\n"
                f"{numbered}\n"
                "Fix these or set APP_ENV=development. See "
                "documentation/system-design/DEPLOYMENT.md § 0."
            )

    def audit_environment(self) -> tuple[list[str], list[str]]:
        """Return `(problems, warnings)` for the current environment.

        Split out from the validator so it is callable — a test can assert each
        rule, and a pre-deploy check can print the report without having to
        provoke an exception. Returns empty lists outside production.
        """
        if not self.is_production:
            return [], []

        problems: list[str] = []
        warnings: list[str] = []

        # --- Token signing ---------------------------------------------------
        # The highest-consequence rules in this function. A guessable signing key
        # does not compromise one account; it forges an access token for every
        # account, and nothing in the logs would look unusual.
        secret = self.SECRET_KEY.strip()
        lowered = secret.lower()
        generate = (
            'Generate one with `python -c "import secrets; '
            'print(secrets.token_urlsafe(48))"`.'
        )

        if len(secret) < _MIN_SECRET_KEY_LENGTH:
            problems.append(
                f"SECRET_KEY is {len(secret)} characters; at least "
                f"{_MIN_SECRET_KEY_LENGTH} are required. {generate}"
            )
        elif lowered in _PLACEHOLDER_EXACT or any(
            marker in lowered for marker in _PLACEHOLDER_SUBSTRINGS
        ):
            problems.append(
                "SECRET_KEY contains a known placeholder value. Generate a fresh one "
                f"per environment and never reuse the development key. {generate}"
            )
        elif len(set(secret)) < _MIN_SECRET_KEY_DISTINCT_CHARS:
            # Catches a long key built by repeating something short, which clears
            # the length floor while carrying almost none of its entropy.
            problems.append(
                f"SECRET_KEY is {len(secret)} characters but uses only "
                f"{len(set(secret))} distinct ones, so it is a repeated pattern "
                f"rather than a random key. {generate}"
            )

        # `none` is a real, accepted JWS algorithm meaning "unsigned". python-jose
        # will not sign with it, but a caller could set it and the failure would
        # surface as broken auth rather than as the security hole it is.
        if self.ALGORITHM.strip().lower() in {"none", ""}:
            problems.append(
                f"ALGORITHM is {self.ALGORITHM!r}, which disables token signing. Use HS256."
            )

        # --- Cookies ---------------------------------------------------------
        if not self.COOKIE_SECURE:
            problems.append(
                "COOKIE_SECURE is False, so session cookies would travel in "
                "cleartext. Set COOKIE_SECURE=true (requires TLS in front)."
            )

        # SameSite=None without Secure is rejected outright by browsers — the
        # exact failure PM-2 describes, where the expiring Set-Cookie is dropped
        # and logout silently leaves the session cookie in place.
        if self.COOKIE_SAMESITE.strip().lower() == "none" and not self.COOKIE_SECURE:
            problems.append(
                "COOKIE_SAMESITE=none requires COOKIE_SECURE=true; browsers reject "
                "a SameSite=None cookie sent without Secure, which would break logout."
            )

        # --- Mail ------------------------------------------------------------
        # The most dangerous entry in this function, because it fails silently and
        # successfully: `console` works perfectly and writes a working credential
        # to a file with a different audience than the database has.
        backend = self.MAIL_BACKEND.strip().lower()
        if backend == "console":
            problems.append(
                "MAIL_BACKEND=console writes password-reset links to the log, and a "
                "reset link is a working credential for anyone who can read logs. "
                "Set MAIL_BACKEND=smtp."
            )
        elif backend == "smtp" and not self.SMTP_HOST.strip():
            problems.append("MAIL_BACKEND=smtp but SMTP_HOST is empty; every send would fail.")
        elif backend not in {"console", "smtp"}:
            problems.append(f"MAIL_BACKEND={self.MAIL_BACKEND!r} is not a known backend.")

        # --- CORS ------------------------------------------------------------
        # allow_credentials=True is set in main.py, so a localhost origin here lets
        # any developer machine call production *with the session cookie attached*.
        local = [o for o in self.allowed_origins if "localhost" in o or "127.0.0.1" in o]
        if local:
            problems.append(
                f"CORS_ORIGINS still allows {', '.join(local)}. With allow_credentials, "
                "a developer machine could call production with a session cookie."
            )
        if not self.allowed_origins:
            problems.append("CORS_ORIGINS is empty; the frontend would be blocked by the browser.")

        # --- Rate limiting ---------------------------------------------------
        if not self.RATE_LIMIT_ENABLED:
            problems.append(
                "RATE_LIMIT_ENABLED is False, removing the only per-IP control. "
                "Leave it on unless a reverse proxy is doing the limiting."
            )

        # --- Observability ---------------------------------------------------
        if self.LOG_FORMAT.strip().lower() != "json":
            problems.append(
                f"LOG_FORMAT={self.LOG_FORMAT!r}; use json in a deployed environment. "
                "grep does not survive multi-line tracebacks."
            )

        # --- Warnings, not refusals -----------------------------------------
        # Both of these are legitimate production choices, so refusing would be
        # wrong. They are surfaced because getting them wrong is quiet.
        if not self.HSTS_ENABLED:
            warnings.append(
                "HSTS_ENABLED is False. Correct if the TLS terminator sets "
                "Strict-Transport-Security itself; otherwise nothing prevents a "
                "downgrade attack from seeing the auth cookie."
            )

        # Deliberately never auto-corrected. Enabling TRUST_PROXY_HEADERS without a
        # proxy that overwrites X-Forwarded-For restores the measured rate-limit
        # bypass in PM-26 exactly — 14 requests through a limit of 10.
        if not self.TRUST_PROXY_HEADERS:
            warnings.append(
                "TRUST_PROXY_HEADERS is False, so client IPs come from the socket. "
                "Correct with no reverse proxy. Enable it ONLY in the same change "
                "that puts one in front — never before (PM-26)."
            )

        return problems, warnings


settings = Settings()
