"""Seed the API service providers and their field schemas.

    docker compose run --rm backend python -m app.db.seed_api_providers

Idempotent, keyed on `slug`, like the reference's
`ApiCredentialsSeeder::updateOrCreate(['slug' => …])`.

## Which providers, and why not all of them

The reference seeds eleven. `LEAPDESK_PARITY_PLAN.md` § Module 7 settles the
port: **four are relevant here** — `google`, `mail`, `anthropic`, `slack`.
`hostbill` and `hubspot` are Leapswitch billing/CRM integrations with no
counterpart in this product, and the remaining rows (`slack_qmas`, `slack_bot`,
`slack_presales`, `google_calendar`, `google_sheets`) belong to LeapDesk plugins
that do not exist here. Seeding them would produce a screen full of providers
nobody can configure and nothing resolves.

## This seeder never touches stored values

It writes `api_service_providers` and `api_credential_schemas` only. Field
declarations are matched on `field_key` and updated in place, **never deleted and
recreated** — `api_credential_values.schema_id` cascades, so recreating a schema
row would silently delete every stored secret for that field in every
environment. A seeder that wipes credentials on a re-run is the worst available
bug in this module, so the update path is explicit about it.

Nothing here is a credential. Every value below is a label, a placeholder or a
documentation URL.
"""

from __future__ import annotations

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.api_credential import ApiCredentialSchema, ApiServiceProvider

#: `is_encrypted` is set per field, following the reference row for row. Note
#: that `google.client_id` is encrypted even though a client id is semi-public —
#: that is the reference's call and it is kept, because the pair of id and secret
#: is what identifies the OAuth app and there is no cost to protecting both.
PROVIDERS: list[dict] = [
    {
        "slug": "google",
        "name": "Google",
        "description": "Google OAuth client for single sign-on",
        "icon": "key",
        "documentation_url": "https://console.cloud.google.com/apis/credentials",
        "category": "auth",
        "is_system": True,
        "display_order": 1,
        "setup_steps": [
            "Open Google Cloud Console → APIs & Services → Credentials",
            "Create an OAuth 2.0 Client ID of type Web application",
            "Add your callback URL to Authorised redirect URIs",
            "Copy the Client ID and Client Secret below",
        ],
        "schemas": [
            {
                "field_key": "client_id",
                "field_label": "Client ID",
                "field_type": "text",
                "is_required": True,
                "is_encrypted": True,
                "placeholder": "xxxxx.apps.googleusercontent.com",
            },
            {
                "field_key": "client_secret",
                "field_label": "Client Secret",
                "field_type": "password",
                "is_required": True,
                "is_encrypted": True,
                "placeholder": "GOCSPX-xxxxx",
            },
            {
                "field_key": "redirect_uri",
                "field_label": "Redirect URI",
                "field_type": "url",
                "is_required": True,
                "is_encrypted": False,
                "placeholder": "https://yourapp.com/auth/google/callback",
                "help_text": "Must match the URI in Google Console",
            },
        ],
    },
    {
        "slug": "mail",
        "name": "Mail (SMTP)",
        "description": "Outbound email transport",
        "icon": "invitations",
        "documentation_url": None,
        "category": "communication",
        "is_system": True,
        "display_order": 2,
        "setup_steps": [
            "Get the SMTP host, port and credentials from your mail provider",
            "Choose the encryption your provider requires — usually TLS on 587",
            "Set a From address on a domain you are allowed to send for",
        ],
        "schemas": [
            {
                "field_key": "mailer",
                "field_label": "Mailer",
                "field_type": "select",
                "is_required": True,
                "is_encrypted": False,
                "field_options": {"smtp": "SMTP", "sendmail": "Sendmail", "ses": "Amazon SES", "postmark": "Postmark"},
                "default_value": "smtp",
            },
            {
                "field_key": "host",
                "field_label": "SMTP Host",
                "field_type": "text",
                "is_required": True,
                "is_encrypted": False,
                "placeholder": "smtp.example.com",
            },
            {
                "field_key": "port",
                "field_label": "SMTP Port",
                "field_type": "number",
                "is_required": True,
                "is_encrypted": False,
                "placeholder": "587",
                "default_value": "587",
            },
            {
                "field_key": "encryption",
                "field_label": "Encryption",
                "field_type": "select",
                "is_required": False,
                "is_encrypted": False,
                "field_options": {"tls": "TLS", "ssl": "SSL", "": "None"},
                "default_value": "tls",
            },
            {
                "field_key": "username",
                "field_label": "Username",
                "field_type": "text",
                "is_required": True,
                "is_encrypted": True,
                "placeholder": "your-smtp-username",
            },
            {
                "field_key": "password",
                "field_label": "Password",
                "field_type": "password",
                "is_required": True,
                "is_encrypted": True,
                "placeholder": "your-smtp-password",
            },
            {
                "field_key": "from_address",
                "field_label": "From Address",
                "field_type": "email",
                "is_required": True,
                "is_encrypted": False,
                "placeholder": "noreply@example.com",
            },
            {
                "field_key": "from_name",
                "field_label": "From Name",
                "field_type": "text",
                "is_required": True,
                "is_encrypted": False,
                "placeholder": "Partner Marketplace",
            },
        ],
    },
    {
        "slug": "anthropic",
        "name": "Anthropic",
        "description": "Claude API key. Gates the AI Assistant (Module 9)",
        "icon": "dot",
        "documentation_url": "https://docs.anthropic.com/en/api/getting-started",
        "category": "api",
        "is_system": True,
        "display_order": 3,
        "setup_steps": [
            "Go to console.anthropic.com and sign in",
            "Open Settings → API Keys",
            "Create a new API key (it starts with sk-ant-)",
            "Paste the key below and choose the default model",
            "Enable the integration, then turn on the AI Assistant",
        ],
        "schemas": [
            {
                "field_key": "api_key",
                "field_label": "API Key",
                "field_type": "password",
                "is_required": True,
                "is_encrypted": True,
                "placeholder": "sk-ant-api03-...",
                "help_text": "Kept encrypted at rest. Revealing it is audited.",
            },
            # Model list intentionally left to the operator rather than seeded
            # with fixed ids: a hardcoded catalogue goes stale silently, and this
            # field is a free-text model name the API passes straight through.
            {
                "field_key": "default_model",
                "field_label": "Default Model",
                "field_type": "text",
                "is_required": False,
                "is_encrypted": False,
                "default_value": "claude-sonnet-5",
                "help_text": "Model id the assistant uses for replies",
            },
            {
                "field_key": "enabled",
                "field_label": "Anthropic Enabled",
                "field_type": "boolean",
                "is_required": False,
                "is_encrypted": False,
                "default_value": "0",
                "help_text": "Master switch for the Anthropic integration",
            },
        ],
    },
    {
        "slug": "slack",
        "name": "Slack",
        "description": "Incoming webhook for notifications",
        "icon": "dot",
        "documentation_url": "https://api.slack.com/messaging/webhooks",
        "category": "communication",
        "is_system": True,
        "display_order": 4,
        "setup_steps": [
            "Create a Slack app at api.slack.com/apps",
            "Enable Incoming Webhooks and add one to a channel",
            "Copy the webhook URL below",
        ],
        "schemas": [
            # The webhook URL is encrypted: anyone holding it can post into the
            # channel as the app, so it is a credential rather than a setting.
            {
                "field_key": "webhook_url",
                "field_label": "Webhook URL",
                "field_type": "password",
                "is_required": True,
                "is_encrypted": True,
                "placeholder": "https://hooks.slack.com/services/xxx/xxx/xxx",
            },
            {
                "field_key": "enabled",
                "field_label": "Notifications Enabled",
                "field_type": "boolean",
                "is_required": False,
                "is_encrypted": False,
                "default_value": "0",
                "help_text": "Enable or disable Slack notifications",
            },
        ],
    },
]


def seed() -> None:
    db = SessionLocal()
    created = updated = fields_added = fields_updated = 0

    try:
        for spec in PROVIDERS:
            schemas = spec["schemas"]
            attrs = {k: v for k, v in spec.items() if k != "schemas"}

            provider = db.scalar(
                select(ApiServiceProvider).where(ApiServiceProvider.slug == attrs["slug"])
            )

            if provider is None:
                provider = ApiServiceProvider(**attrs)
                db.add(provider)
                db.flush()
                created += 1
                print(f"  created  {attrs['slug']}")
            else:
                for key, value in attrs.items():
                    setattr(provider, key, value)
                updated += 1
                print(f"  updated  {attrs['slug']}")

            existing = {
                s.field_key: s
                for s in db.scalars(
                    select(ApiCredentialSchema).where(
                        ApiCredentialSchema.provider_id == provider.id
                    )
                )
            }

            for order, field in enumerate(schemas):
                row = existing.get(field["field_key"])
                if row is None:
                    db.add(
                        ApiCredentialSchema(
                            provider_id=provider.id, display_order=order, **field
                        )
                    )
                    fields_added += 1
                else:
                    # Updated in place. Never deleted and re-added — the value
                    # rows cascade off `schema_id`.
                    for key, value in field.items():
                        setattr(row, key, value)
                    row.display_order = order
                    fields_updated += 1

        db.commit()
        print(
            f"\nProviders: {created} created, {updated} updated. "
            f"Fields: {fields_added} added, {fields_updated} updated."
        )
        print("No stored credential values were touched.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
