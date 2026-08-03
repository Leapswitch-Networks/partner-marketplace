from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

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


settings = Settings()
