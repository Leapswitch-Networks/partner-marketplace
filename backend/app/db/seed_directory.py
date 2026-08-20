"""Sample data for the directory — categories, partners, listings, enquiries.

⚠️ **Everything here is obviously fictional and must stay that way.** This repo
is public (operating contract rule 7), so no real company name, address, email
or phone number belongs in this file. The partners below are invented and the
domains are `example.com`, which is reserved by RFC 2606 precisely for this.

## What it seeds, and why the shape matters

Not just "some rows". The end-to-end walk in `DIRECTORY_BUILD_PUNCHLIST.md` § 6.3
needs every state to exist at once, because the states are what the product is:

* listings in **all four** statuses, so the moderation queue has something in it
  and the public surface has something to hide
* enquiries **answered and unanswered**, so § 16.2's unanswered rate is not
  trivially zero
* one partner that is **not listed**, so "invisible to the public" can be tested
  rather than assumed
* one **partner login per listed organisation**, because the partner back office
  is unreachable without one — see `PARTNER_LOGIN_PASSWORD` below

Idempotent: run it twice and it will not duplicate. Anything already present by
slug is left alone.
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.domain.partners.permissions import ROLE_PARTNER
from app.models.enquiry import Enquiry, EnquiryMessage, EnquiryRecipient
from app.models.partner import Partner
from app.models.role import Role
from app.models.service_category import ServiceCategory
from app.models.service_listing import ServiceListing
from app.models.user import User

CATEGORIES: list[tuple[str, str, list[str]]] = [
    (
        "Cloud & infrastructure",
        "cloud-infrastructure",
        ["Managed Kubernetes", "Cloud migration", "Bare metal & colocation"],
    ),
    ("Data & AI", "data-ai", ["Data platforms", "GPU & AI workloads", "Object storage"]),
    (
        "Security & compliance",
        "security-compliance",
        ["ISO 27001 readiness", "Penetration testing", "Backup & disaster recovery"],
    ),
    (
        "Applications",
        "applications",
        ["WordPress & Magento", "DevOps & automation", "Business email"],
    ),
]

PARTNERS = [
    {
        "name": "Northwind Cloud Services",
        "city": "Pune",
        "tagline": "Kubernetes platforms built, run and monitored around the clock.",
        "verification": "PREMIER",
        "listed": True,
        "founded": 2014,
        "size": "50-200",
        "expertise": ["Managed Kubernetes", "Cloud migration", "DevOps & automation"],
    },
    {
        "name": "Meridian Datalabs",
        "city": "Bengaluru",
        "tagline": "Data platforms and GPU capacity for teams leaving the hyperscalers.",
        "verification": "VERIFIED",
        "listed": True,
        "founded": 2018,
        "size": "11-50",
        "expertise": ["Data platforms", "GPU & AI workloads", "Object storage"],
    },
    {
        "name": "Safeharbour Security",
        "city": "Mumbai",
        "tagline": "Compliance-ready infrastructure with the evidence pack auditors ask for.",
        "verification": "PREMIER",
        "listed": True,
        "founded": 2011,
        "size": "11-50",
        "expertise": ["ISO 27001 readiness", "Penetration testing", "Backup & disaster recovery"],
    },
    {
        "name": "Brightpath DevOps",
        "city": "Nashik",
        "tagline": "Pipelines and on-call for teams who would rather be shipping.",
        "verification": "VERIFIED",
        "listed": True,
        "founded": 2020,
        "size": "1-10",
        "expertise": ["DevOps & automation", "Managed Kubernetes"],
    },
    {
        "name": "Corvus Networks",
        "city": "Delhi",
        "tagline": "Network design and colocation, cabled by people who show up.",
        "verification": "VERIFIED",
        "listed": True,
        "founded": 2009,
        "size": "50-200",
        "expertise": ["Bare metal & colocation", "Backup & disaster recovery"],
    },
    {
        "name": "Tessellate Studio",
        "city": "Hyderabad",
        "tagline": "Managed WordPress, Magento and email for agencies.",
        "verification": "UNVERIFIED",
        "listed": True,
        "founded": 2021,
        "size": "11-50",
        "expertise": ["WordPress & Magento", "Business email"],
    },
    {
        # ⚠️ Deliberately NOT listed. § 6.5's negative tests need a partner the
        # public API must refuse — without one, "unlisted partners are hidden"
        # is a claim nobody has checked.
        "name": "Halcyon Systems",
        "city": "Chennai",
        "tagline": "Awaiting verification — should never appear publicly.",
        "verification": "UNVERIFIED",
        "listed": False,
        "founded": 2023,
        "size": "1-10",
        "expertise": ["Cloud migration"],
    },
]


#: The shared password for every seeded partner login.
#:
#: Committed on purpose, and safe to commit for exactly one reason: it only ever
#: unlocks accounts at `@example.com`, which is RFC 2606 reserved and cannot
#: receive mail, in a database that only ever holds invented companies. It is
#: written to be unmistakable at a glance — nobody skims this and wonders whether
#: it is a real credential (operating contract rule 7).
#:
#: ⚠️ It is still a known password in a public repo. `seed()` therefore refuses to
#: create these accounts unless `ALLOW_DEMO_PARTNER_LOGINS=1` is set, so a
#: production deploy that runs the seeder cannot quietly acquire nine accounts
#: whose password is printed in this file.
PARTNER_LOGIN_PASSWORD = "demo-partner-not-a-real-password"

#: The environment flag that has to be set before the logins above are created.
DEMO_LOGIN_ENV = "ALLOW_DEMO_PARTNER_LOGINS"


def _slug(value: str) -> str:
    import re

    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def seed(db: Session) -> dict[str, int]:
    counts = {
        "categories": 0,
        "partners": 0,
        "listings": 0,
        "enquiries": 0,
        "partner_logins": 0,
    }
    now = datetime.now(timezone.utc)

    # --- Taxonomy ---------------------------------------------------------
    children: dict[str, ServiceCategory] = {}
    for order, (name, slug, subs) in enumerate(CATEGORIES):
        parent = db.execute(
            select(ServiceCategory).where(ServiceCategory.slug == slug)
        ).scalar_one_or_none()
        if parent is None:
            parent = ServiceCategory(name=name, slug=slug, sort_order=order, is_active=True)
            db.add(parent)
            db.flush()
            counts["categories"] += 1
        for sub_order, sub in enumerate(subs):
            sub_slug = _slug(sub)
            child = db.execute(
                select(ServiceCategory).where(ServiceCategory.slug == sub_slug)
            ).scalar_one_or_none()
            if child is None:
                child = ServiceCategory(
                    name=sub, slug=sub_slug, parent_id=parent.id, sort_order=sub_order
                )
                db.add(child)
                db.flush()
                counts["categories"] += 1
            children[sub] = child

    # --- Partners ---------------------------------------------------------
    created: list[Partner] = []
    for spec in PARTNERS:
        slug = _slug(spec["name"])
        partner = db.execute(
            select(Partner).where(Partner.slug == slug)
        ).scalar_one_or_none()
        if partner is None:
            partner = Partner(
                id=str(uuid.uuid4()),
                name=spec["name"],
                slug=slug,
                tagline=spec["tagline"],
                about=(
                    f"{spec['name']} is an independent company listed on this platform. "
                    f"{spec['tagline']} Founded in {spec['founded']}, the team is "
                    f"{spec['size']} people."
                ),
                status="ACTIVE",
                verification_level=spec["verification"],
                is_listed=spec["listed"],
                published_at=now if spec["listed"] else None,
                founded_year=spec["founded"],
                employee_range=spec["size"],
                city=spec["city"],
                state="Maharashtra" if spec["city"] in ("Pune", "Mumbai", "Nashik") else None,
                country="India",
                website=f"https://example.com/{slug}",
                public_email=f"hello@{slug}.example.com",
                service_areas=f"{spec['city']} · Remote — all India",
            )
            db.add(partner)
            db.flush()
            counts["partners"] += 1
        partner.expertise = [children[e] for e in spec["expertise"] if e in children]
        created.append(partner)
    db.flush()

    listed = [p for p in created if p.is_listed]

    # --- Listings, across all four statuses -------------------------------
    #
    # The spread is the point: PUBLISHED so the public surface has content,
    # PENDING_REVIEW so the moderation queue is not empty, REJECTED so a partner
    # can see a reason, DRAFT so "not public yet" is testable.
    statuses = ["PUBLISHED", "PUBLISHED", "PENDING_REVIEW", "DRAFT", "REJECTED"]
    for partner in listed:
        expertise = partner.expertise or list(children.values())[:1]
        for index, status in enumerate(statuses):
            title = f"{expertise[index % len(expertise)].name} — {partner.name.split()[0]}"
            slug = _slug(f"{title}-{index}")
            if db.execute(
                select(ServiceListing).where(ServiceListing.slug == slug)
            ).scalar_one_or_none():
                continue
            db.add(
                ServiceListing(
                    id=str(uuid.uuid4()),
                    partner_id=partner.id,
                    category_id=expertise[index % len(expertise)].id,
                    title=title,
                    slug=slug,
                    summary=(
                        f"{expertise[index % len(expertise)].name} delivered end to end, "
                        "with handover documentation and a named engineer."
                    ),
                    description=(
                        "Scoping, delivery and handover. Includes documentation, a named "
                        "engineer for the duration, and an agreed support window afterwards."
                    ),
                    pricing_model="FROM" if index % 2 == 0 else "ON_REQUEST",
                    price=14000 + index * 3500 if index % 2 == 0 else None,
                    currency="INR",
                    status=status,
                    rejection_reason=(
                        "Please add what is NOT included — buyers are asking and it saves you "
                        "the first email." if status == "REJECTED" else None
                    ),
                    published_at=now - timedelta(days=index) if status == "PUBLISHED" else None,
                    submitted_at=now - timedelta(days=index + 1)
                    if status in ("PENDING_REVIEW", "PUBLISHED", "REJECTED")
                    else None,
                )
            )
            counts["listings"] += 1
    db.flush()

    # Denormalised counts, recomputed rather than incremented.
    from app.services import category_service

    for category in db.execute(select(ServiceCategory)).scalars().all():
        category_service.recount_listings(db, category.id)

    # --- Enquiries, answered and not --------------------------------------
    buyers = [
        ("Asha Menon", "asha@example.com", "Ledgerline", "₹1–5 lakh", "Within a month"),
        ("Rahul Nair", "rahul@example.com", "Prism Retail", "₹5–10 lakh", "This quarter"),
        ("Divya Rao", "divya@example.com", None, None, None),
    ]
    for index, partner in enumerate(listed[:4]):
        name, email, company, budget, timeline = buyers[index % len(buyers)]
        exists = db.execute(
            select(Enquiry).where(
                Enquiry.partner_id == partner.id, Enquiry.buyer_email == email
            )
        ).scalar_one_or_none()
        if exists:
            continue
        answered = index % 2 == 0
        enquiry = Enquiry(
            id=str(uuid.uuid4()),
            partner_id=partner.id,
            buyer_name=name,
            buyer_email=email,
            company=company,
            message=(
                "We are moving off a hyperscaler and need help sizing the migration. "
                "Can you take a look and tell us what it would involve?"
            ),
            budget_range=budget,
            timeline=timeline,
            source="PROFILE",
            status="RESPONDED" if answered else "NEW",
            first_responded_at=now - timedelta(hours=6) if answered else None,
            created_at=now - timedelta(days=index + 1),
        )
        db.add(enquiry)
        db.flush()
        db.add(
            EnquiryMessage(
                id=str(uuid.uuid4()),
                enquiry_id=enquiry.id,
                direction="FROM_BUYER",
                body=enquiry.message,
            )
        )
        if answered:
            db.add(
                EnquiryMessage(
                    id=str(uuid.uuid4()),
                    enquiry_id=enquiry.id,
                    direction="FROM_PARTNER",
                    body="Happy to help — can we get 30 minutes this week to size it properly?",
                )
            )
        db.add(
            EnquiryRecipient(
                id=str(uuid.uuid4()), enquiry_id=enquiry.id, partner_id=partner.id
            )
        )
        counts["enquiries"] += 1

    # --- Partner logins ---------------------------------------------------
    #
    # Added 2026-08-18. Seven partner ORGANISATIONS existed and zero partner
    # USERS, so the five partner-only back-office pages had nobody who could
    # open them — the whole partner half of the product was untestable, and the
    # navigation fix that made those pages reachable could only be verified for
    # staff. An organisation with no way in is sample data that proves half the
    # loop.
    #
    # Skipped unless the flag is set: see PARTNER_LOGIN_PASSWORD.
    if os.environ.get(DEMO_LOGIN_ENV, "").strip() in {"1", "true", "yes"}:
        counts["partner_logins"] = _seed_partner_logins(db, created)
    else:
        print(
            f"[seed_directory] partner logins skipped — set {DEMO_LOGIN_ENV}=1 to create them"
        )

    db.commit()
    return counts


def _seed_partner_logins(db: Session, partners: list[Partner]) -> int:
    """One ACTIVE partner login per listed organisation, idempotent by email.

    The unlisted partner is deliberately included: "this organisation is hidden
    from the public but its owner can still sign in and edit it" is a real state,
    and it is the one that proves the public surface hides on `listed`, not on
    whether anybody is home.
    """
    role = db.execute(select(Role).where(Role.name == ROLE_PARTNER)).scalar_one_or_none()
    if role is None:
        print(f"[seed_directory] role {ROLE_PARTNER!r} missing — run seed_rbac first")
        return 0

    hashed = hash_password(PARTNER_LOGIN_PASSWORD)
    now = datetime.now(timezone.utc)
    created = 0

    for partner in partners:
        email = f"owner@{partner.slug}.example.com"
        if db.execute(select(User).where(User.email == email)).scalar_one_or_none():
            continue

        user = User(
            email=email,
            password=hashed,
            first_name="Partner",
            last_name="Owner",
            account_type="external",
            auth_provider="password",
            status="ACTIVE",
            email_verified_at=now,
            organisation_id=partner.id,
            company_name=partner.name,
        )
        user.roles.append(role)
        db.add(user)
        created += 1

    if created:
        print(
            f"[seed_directory] {created} partner logins, password {PARTNER_LOGIN_PASSWORD!r}"
        )

    return created


if __name__ == "__main__":  # pragma: no cover - operational entry point
    from app.db.session import SessionLocal

    with SessionLocal() as session:
        result = seed(session)
    print(f"[seed_directory] {result}")
