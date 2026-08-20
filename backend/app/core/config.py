import logging

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger("app.config")

#: What `STAFF_EMAIL_DOMAINS` ships as. Compared against in `audit_environment`
#: so a deployment that never changed it is warned in production. A literal
#: mirror rather than a reference to the field default, because reading a
#: Pydantic field default at runtime is indirection for one string.
_SHIPPED_STAFF_DOMAINS = "leapswitch.com"

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

    # --- API versioning (CORE_HARDENING_PLAN PM-40) --------------------------
    # Every router mounts under this. It was `/api` for 60 routes, which cost nothing
    # while there was one client in one repo deployed together — and would have become
    # a migration the moment a partner integrated, because a breaking change needs a
    # version to live in and adding one retroactively means either breaking every
    # existing caller or running an unversioned alias forever.
    #
    # Not a `Settings` field a deployment can change: the version is a property of the
    # contract, not of the environment. Two deployments of the same code answering on
    # different prefixes is a support problem, not a feature.
    #
    # A v2 goes alongside v1 rather than replacing it — mount a second router set and
    # keep both until callers have moved.
    API_PREFIX: str = "/api/v1"

    # --- Project identity (DYNAMIC_BRANDING_PLAN phase 1) --------------------
    # These are the BUILD-TIME defaults and the fallback whenever `app_settings`
    # is empty or a column is NULL. That fallback is load-bearing rather than
    # defensive: a fresh install has no settings row, and the sign-in page still
    # has to render a name.
    #
    # For a new project built on this core, setting these five is the whole job —
    # no database write required. The Settings module then lets an administrator
    # override them at runtime without a redeploy.
    APP_NAME: str = "Partner Marketplace"
    #: Shown where horizontal space is tight — the collapsed sidebar, narrow chrome.
    APP_SHORT_NAME: str = "Partner MP"
    #: The square badge beside the name. One or two characters; more will clip.
    APP_MONOGRAM: str = "P"
    #: The small uppercase line under the name in the sidebar.
    APP_CHROME_SUBTITLE: str = "Admin Panel"
    #: The sentence on the sign-in screen. This is product copy, not branding —
    #: a reused core that keeps this default is describing a product it is not.
    APP_TAGLINE: str = "One place to manage partners, catalogue and quotes."

    # --- Database -----------------------------------------------------------
    DATABASE_URL: str

    # --- JWT ----------------------------------------------------------------
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    #: Default session lifetime, when "keep me signed in" is NOT ticked.
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    #: Session lifetime when it IS ticked.
    #:
    #: The checkbox existed on the sign-in form from the start and **did nothing** —
    #: it was in the Zod schema and rendered, and no backend ever heard of it. A user
    #: reported ticking it every time and still being signed out, which turned out to
    #: have a different cause (the edge middleware; see `frontend/middleware.ts`), but
    #: the checkbox was lying regardless.
    #:
    #: This is the whole difference the tick makes: how long the session and its
    #: cookies live. It is not "remember my password" — nothing stores a password —
    #: which is why the label was corrected too.
    REMEMBER_ME_DAYS: int = 30

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
    # INTERNAL accounts are domain-gated and may use Google SSO. Anyone else may
    # register with credentials as an EXTERNAL account and lands INACTIVE pending
    # approval.
    #
    # Comma-separated so one env var can carry several domains.
    #: **Deployment configuration that ships with this project's value.**
    #: `_SHIPPED_STAFF_DOMAINS` mirrors it so the production audit can warn when
    #: a second installation has not changed it. Left non-empty rather than
    #: blanked, because an empty value silently turns off the internal-account
    #: gate and would let a staff address self-register as external.
    #:
    #: ⚠️ **`CORE_EXTRACTION_PLAN.md` § 5.3 proposed blanking this default. That
    #: was checked against the call sites on 2026-08-20 and rejected**, because
    #: `is_staff_email()` would then be False for every address and all three of
    #: its callers change behaviour at once: Google sign-in refuses everyone
    #: (`google_service`), internal invitations become impossible
    #: (`invitation_service`), and the guard that stops a staff address
    #: self-registering with a password stops firing (`auth_service`). The
    #: plan's underlying concern — that shipping another company's domain is
    #: wrong for a reusable core — is real, and is answered by the production
    #: warning in `audit_environment` rather than by a default that breaks the
    #: application it ships in.
    STAFF_EMAIL_DOMAINS: str = "leapswitch.com"
    #: Renamed from `ALLOW_PARTNER_SELF_REGISTRATION` on 2026-08-17
    #: (`CORE_EXTRACTION_PLAN.md` phase 1). "Partner" is this project's domain
    #: word for an external account; the core setting is named for the account
    #: class so it survives into a project with clinics or suppliers instead.
    #:
    #: The old env name still works — `AliasChoices` accepts both — because a
    #: deployed `.env` carrying the old key must not silently flip a signup policy
    #: back to its default. It is not set in this repo's `.env`, so nothing here
    #: depended on it; the alias is for deployments, not for us.
    ALLOW_EXTERNAL_SELF_REGISTRATION: bool = Field(
        default=True,
        validation_alias=AliasChoices(
            "ALLOW_EXTERNAL_SELF_REGISTRATION",
            "ALLOW_PARTNER_SELF_REGISTRATION",
        ),
    )
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

    # --- Log retention: age AND size -----------------------------------------
    #
    # **Two limits per table, because age alone does not bound a database.** A
    # 90-day window says nothing about how many rows arrive in 90 days, and the
    # tables that grow fastest grow fastest exactly when something is wrong — a
    # retry loop, an incident, a webhook receiver refusing everything. `*_MAX_ROWS`
    # is the limit that actually caps disk; `*_DAYS` is the policy about how far
    # back questions can be answered. See `core/retention.py`.
    #
    # `0` disables either limit individually.

    # Audit trail. Two years is a common floor for access records.
    ACTIVITY_LOG_RETENTION_DAYS: int = 730
    #: **Off by default, and this is the one deliberate exception.** Every other
    #: table here is telemetry; this one is evidence. `activity_service` and
    #: `db/maintenance.py` both say in as many words that how long who-did-what is
    #: kept is a policy decision — legal, contractual, or simply how far back you
    #: want to be able to answer questions — and that a default must not quietly
    #: start deleting it. A row cap would do exactly that, and would drop the
    #: OLDEST evidence first, which is the half an investigation needs.
    #:
    #: Set it if the audit trail genuinely threatens disk, and know that you are
    #: choosing a size budget over an answerable history.
    ACTIVITY_LOG_MAX_ROWS: int = 0

    # API traffic. The comment on the job that trims it is worth repeating: this
    # table grows fastest when something is wrong.
    API_REQUEST_LOG_RETENTION_DAYS: int = 90
    API_REQUEST_LOG_MAX_ROWS: int = 500_000

    # Webhook delivery attempts. One row per attempt, and a failing receiver is
    # retried — so a single broken endpoint is the worst case here.
    WEBHOOK_DELIVERY_RETENTION_DAYS: int = 30
    WEBHOOK_DELIVERY_MAX_ROWS: int = 200_000

    # Error occurrences. One row per raised error; an incident is a burst.
    # The GROUPS are kept — they are the triage surface and there are few of
    # them. Only the individual occurrences are trimmed.
    ERROR_OCCURRENCE_RETENTION_DAYS: int = 90
    ERROR_OCCURRENCE_MAX_ROWS: int = 200_000

    # Search queries. Useful for "what are people looking for", worthless at
    # eighteen months old.
    SEARCH_LOG_RETENTION_DAYS: int = 90
    SEARCH_LOG_MAX_ROWS: int = 200_000

    # The worker's own run history. Every table that only grows needs an answer,
    # including the monitoring one.
    WORKER_RUN_RETENTION_DAYS: int = 30
    WORKER_RUN_MAX_ROWS: int = 50_000

    #: Rows deleted per statement. A single `DELETE` over millions of rows takes a
    #: long lock and one enormous transaction; batching keeps the table available
    #: between passes and makes an interrupted sweep still count.
    RETENTION_BATCH_SIZE: int = 5_000
    #: Batches per policy per run. Bounds one sweep so a wildly oversized table
    #: cannot make the worker's tick take an hour — the next tick continues.
    #: 200 × 5,000 = one million rows per table per run.
    RETENTION_MAX_BATCHES: int = 200

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
    #
    # Empty means "follow APP_NAME", resolved in model_post_init. A literal default
    # here would put this project's name in the authenticator app of every project
    # built on this core — and unlike most branding slips, that one is baked into
    # already-enrolled devices and cannot be corrected without re-enrolment.
    TWO_FACTOR_ISSUER: str = ""

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
    #: Empty means "derive from the first staff domain" — see `model_post_init`,
    #: the same treatment `TWO_FACTOR_ISSUER` and `MAIL_FROM_NAME` already get.
    #:
    #: It used to be the literal `no-reply@leapswitch.com`, which is a fossil in
    #: any project built on this core: the next installation would send mail
    #: from a company it has nothing to do with, and the bounce would go
    #: somewhere nobody was watching. `CORE_EXTRACTION_PLAN.md` phase 5.
    MAIL_FROM: str = ""
    #: Empty means "follow APP_NAME" — see TWO_FACTOR_ISSUER.
    MAIL_FROM_NAME: str = ""
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
    # The loopback IP is listed alongside the hostname because `localhost` and
    # `127.0.0.1` are DIFFERENT ORIGINS to the browser's same-origin policy, even
    # though they reach the same machine. A dev server reached over the IP — which
    # is what VS Code's port forwarding hands you — fails the login preflight with
    # no Access-Control-Allow-Origin, and axios reports that as an opaque
    # "Network error" rather than anything mentioning CORS. Both spellings of both
    # dev ports are allowed so the address bar cannot cause it.
    #
    # This is the DEVELOPMENT default only. Production must set CORS_ORIGINS to
    # real hostnames: with allow_credentials=True a loopback origin left in the
    # allowlist is flagged by audit_environment() below.
    CORS_ORIGINS: str = (
        "http://localhost:3000,http://localhost:3001,"
        "http://127.0.0.1:3000,http://127.0.0.1:3001"
    )

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

    @property
    def primary_domain(self) -> str:
        """The first configured staff domain, or a neutral placeholder.

        Used to derive `MAIL_FROM` and the seeder's default root address, so a
        new installation sets ONE value and both follow. `localhost` rather than
        a real-looking fallback: an address at a domain nobody owns bounces
        loudly, which is the correct outcome for an unconfigured installation.
        """
        domains = self.staff_domains
        return domains[0] if domains else "localhost"

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

        Also resolves the two identity fields that default to APP_NAME. Done here
        rather than as properties so `settings.TWO_FACTOR_ISSUER` keeps working at
        its existing call site and nothing has to know the value is derived.
        """
        if not self.TWO_FACTOR_ISSUER.strip():
            self.TWO_FACTOR_ISSUER = self.APP_NAME
        if not self.MAIL_FROM_NAME.strip():
            self.MAIL_FROM_NAME = self.APP_NAME
        # Addresses derive from the configured domain rather than being written
        # into the code. One setting decides the installation's identity, which
        # is what makes the core liftable — CORE_EXTRACTION_PLAN.md phase 5.
        if not self.MAIL_FROM.strip():
            self.MAIL_FROM = f"no-reply@{self.primary_domain}"

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

        # --- Installation identity -------------------------------------------
        # A warning, not a problem: `leapswitch.com` is correct for THIS
        # deployment and wrong for every other one built on this core. Shipping
        # it as a code default means a second installation domain-gates its SSO
        # against a company it has no relationship with, and the symptom is
        # "nobody can sign in with Google" — which nobody would trace back here.
        if self.STAFF_EMAIL_DOMAINS.strip() == _SHIPPED_STAFF_DOMAINS:
            warnings.append(
                f"STAFF_EMAIL_DOMAINS is still the shipped default "
                f"({_SHIPPED_STAFF_DOMAINS!r}). Set it to this installation's own "
                "domain(s) — it decides who may sign in with SSO, and it is also "
                "where MAIL_FROM and the seeded root address derive from."
            )

        # Empty is a legitimate configuration — an installation with no internal
        # users at all — but it is indistinguishable from having forgotten to set
        # it, and the three consequences are large enough to be worth stating out
        # loud rather than discovering:
        #
        #   * Google sign-in refuses every address (`google_service`).
        #   * Internal invitations become impossible (`invitation_service`).
        #   * The guard that stops a staff address self-registering with a
        #     password has nothing to match, so it never fires (`auth_service`).
        #
        # A warning and not a problem, because a marketplace-only installation
        # genuinely wants all three. Added 2026-08-20, when CORE_EXTRACTION_PLAN
        # § 5.3 proposed making *empty* the shipped default — see the note on the
        # field for why that was rejected.
        elif not self.staff_domains:
            warnings.append(
                "STAFF_EMAIL_DOMAINS is empty, so this installation has no "
                "internal-account route: Google sign-in will refuse every address "
                "and staff invitations cannot be issued. Intended for an "
                "external-only installation; set a domain if not."
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
