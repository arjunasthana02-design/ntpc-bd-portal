from fastapi import APIRouter

from .documents import router as documents_router
from .submissions import router as submissions_router

router = APIRouter(prefix="/reports")

router.include_router(submissions_router)
router.include_router(documents_router)