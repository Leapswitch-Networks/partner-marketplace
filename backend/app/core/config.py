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
