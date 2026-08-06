from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

from app.core.config import settings
from app.db.base import Base
# EVERY model must be imported here or --autogenerate cannot see it, and may
# emit a migration that drops its table. Add the import in the same commit as
# the model.
#
# Core identity + RBAC
import app.models.associations  # noqa: F401
import app.models.user  # noqa: F401
import app.models.role  # noqa: F401
import app.models.permission  # noqa: F401
import app.models.permission_group  # noqa: F401
import app.models.user_invitation  # noqa: F401
import app.models.user_session  # noqa: F401
import app.models.activity_log  # noqa: F401

# Inherited test-platform domain — see SCAFFOLD_CLEANUP_PLAN § 2

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Override sqlalchemy.url from our settings so .env is the single source of truth
# ConfigParser uses % for interpolation, so literal % chars must be doubled.
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL.replace("%", "%%"))

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
