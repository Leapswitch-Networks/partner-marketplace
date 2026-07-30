from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_admin, get_db
from app.models.admin_user import AdminUser
from app.schemas.auth import MessageResponse
from app.schemas.candidate import CandidateCreate, CandidateResponse, CandidateUpdate
from app.services.candidate_service import (
    create_candidate,
    delete_candidate,
    get_candidate,
    list_candidates,
    update_candidate,
)

router = APIRouter(prefix="/candidates", tags=["candidates"])


@router.get("", response_model=list[CandidateResponse])
def get_candidates(
    db: Session = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
) -> list[CandidateResponse]:
    return list_candidates(db)


@router.get("/{candidate_id}", response_model=CandidateResponse)
def get_candidate_endpoint(
    candidate_id: str,
    db: Session = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
) -> CandidateResponse:
    return get_candidate(db, candidate_id)


@router.post("", response_model=CandidateResponse, status_code=status.HTTP_201_CREATED)
def create_candidate_endpoint(
    data: CandidateCreate,
    db: Session = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
) -> CandidateResponse:
    return create_candidate(db, data)


@router.patch("/{candidate_id}", response_model=CandidateResponse)
def update_candidate_endpoint(
    candidate_id: str,
    data: CandidateUpdate,
    db: Session = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
) -> CandidateResponse:
    return update_candidate(db, candidate_id, data)


@router.delete("/{candidate_id}", response_model=MessageResponse, status_code=status.HTTP_200_OK)
def delete_candidate_endpoint(
    candidate_id: str,
    db: Session = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
) -> MessageResponse:
    delete_candidate(db, candidate_id)
    return MessageResponse(message="Candidate deleted successfully")
