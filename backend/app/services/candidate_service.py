from fastapi import HTTPException, status
from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.models.candidate import Candidate
from app.schemas.candidate import CandidateCreate, CandidateUpdate


def list_candidates(db: Session) -> list[Candidate]:
    return db.query(Candidate).order_by(Candidate.created_at.desc()).all()


def get_candidate(db: Session, candidate_id: str) -> Candidate:
    candidate = db.get(Candidate, candidate_id)
    if candidate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")
    return candidate


def _email_exists(db: Session, email: str) -> bool:
    return db.scalar(select(exists().where(Candidate.email == email))) or False


def create_candidate(db: Session, data: CandidateCreate) -> Candidate:
    email = data.email.strip().lower()
    if _email_exists(db, email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A candidate with this email already exists",
        )
    candidate = Candidate(
        name=data.name.strip(),
        email=email,
        phone=data.phone.strip() if data.phone else None,
        position=data.position.strip() if data.position else None,
        notes=data.notes.strip() if data.notes else None,
    )
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    return candidate


def update_candidate(db: Session, candidate_id: str, data: CandidateUpdate) -> Candidate:
    candidate = get_candidate(db, candidate_id)

    if data.email is not None:
        email = data.email.strip().lower()
        if email != candidate.email:
            if _email_exists(db, email):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A candidate with this email already exists",
                )
            candidate.email = email

    if data.name is not None:
        candidate.name = data.name.strip()
    if data.phone is not None:
        candidate.phone = data.phone.strip() or None
    if data.position is not None:
        candidate.position = data.position.strip() or None
    if data.notes is not None:
        candidate.notes = data.notes.strip() or None

    db.commit()
    db.refresh(candidate)
    return candidate


def delete_candidate(db: Session, candidate_id: str) -> None:
    candidate = get_candidate(db, candidate_id)
    db.delete(candidate)
    db.commit()
