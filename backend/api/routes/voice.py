from fastapi import APIRouter, Request, Depends
import structlog
from typing import Dict, Any

log = structlog.get_logger(__name__)
router = APIRouter()

@router.post("/vapi/webhook", summary="Handle Voice AI End-of-Call Webhooks")
async def vapi_webhook(request: Request):
    """
    Handles end-of-call webhooks from Vapi.ai containing transcripts,
    recordings, and structured summaries of the technical phone screen.
    """
    try:
        payload = await request.json()
    except Exception:
        return {"status": "error", "message": "Invalid JSON"}
        
    message = payload.get("message", {})
    
    # We only care about the end of the call for scoring
    if message.get("type") == "end-of-call-report":
        call_id = message.get("call", {}).get("id")
        transcript = message.get("transcript", "")
        summary = message.get("summary", "")
        
        log.info("voice_screening_completed", call_id=call_id, summary=summary)
        
        # Here we would update the candidate's profile in the DB with the screening results
        # e.g., await db.execute(update(Candidate).where(...).values(screening_transcript=transcript))
        
    return {"status": "received"}
