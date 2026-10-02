from fastapi import APIRouter, Depends
from pydantic import BaseModel
import structlog
from db.models import get_db, User
from api.routes.auth import get_current_user
from backend.agents.tools.memory_tools import fetch_recruiter_preferences, add_recruiter_preference

log = structlog.get_logger(__name__)
router = APIRouter()

class PreferenceAddRequest(BaseModel):
    preference: str

@router.get("/preferences", summary="Get Recruiter AI Preferences")
async def get_preferences(current_user: User = Depends(get_current_user)):
    """
    Fetches the long-term memory constraints (Mem0) that the AI has learned
    about this specific recruiter's sourcing style.
    """
    prefs = fetch_recruiter_preferences(str(current_user.tenant_id), str(current_user.id))
    return {"status": "success", "preferences": prefs}

@router.post("/preferences", summary="Add Recruiter AI Preference")
async def add_preference(req: PreferenceAddRequest, current_user: User = Depends(get_current_user)):
    """
    Manually inject a new preference into the AI's long-term memory.
    """
    success = add_recruiter_preference(str(current_user.tenant_id), str(current_user.id), req.preference)
    if success:
        return {"status": "success", "message": "Preference added to long-term memory."}
    else:
        return {"status": "error", "message": "Failed to add preference."}
