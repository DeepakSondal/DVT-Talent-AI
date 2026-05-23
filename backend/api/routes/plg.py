"""
DVT Talent AI — Product-Led Growth (PLG) Router
Implements the 'Trojan Horse Strategy': 
1. Daily Sales Signals (BizDev Hook)
2. Messy JD Formatter & Silver Medalist Search (Sourcing Hook)
"""
import uuid
import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json

from db.models import get_db
from sqlalchemy.ext.asyncio import AsyncSession

log = structlog.get_logger(__name__)
router = APIRouter(prefix="/plg", tags=["plg", "trojan-horse"])

# ── Pydantic Schemas ─────────────────────────────────────────────────────────

class NicheRequest(BaseModel):
    niche: str

class JDFormatRequest(BaseModel):
    raw_jd: str

# ── API Routes ───────────────────────────────────────────────────────────────

@router.get("/daily-signals")
async def get_daily_signals(niche: str = "Python Developer"):
    """
    BizDev Hook (Phase 1): Returns 3 hot leads for a specific niche.
    The Hiring Manager emails are intentionally blurred out.
    """
    log.info("plg_daily_signals_requested", niche=niche)
    
    # In a real app, this queries the Market IQ Agent's database.
    # For the PLG hook, we mock these to demonstrate value instantly.
    mock_signals = [
        {
            "id": "sig_1",
            "company": "Acme Corp",
            "role": f"Senior {niche}",
            "posted_time": "2 hours ago",
            "hiring_manager_name": "Sarah Jenkins",
            "hiring_manager_title": "VP of Engineering",
            "hiring_manager_email_blurred": "s***********@acmecorp.com",
            "intent_score": 98
        },
        {
            "id": "sig_2",
            "company": "TechFlow Inc.",
            "role": f"Lead {niche}",
            "posted_time": "5 hours ago",
            "hiring_manager_name": "Marcus Wright",
            "hiring_manager_title": "Director of Software",
            "hiring_manager_email_blurred": "m********@techflow.io",
            "intent_score": 92
        },
        {
            "id": "sig_3",
            "company": "FinData Solutions",
            "role": f"{niche} (Contract)",
            "posted_time": "12 hours ago",
            "hiring_manager_name": "Elena Rodriguez",
            "hiring_manager_title": "CTO",
            "hiring_manager_email_blurred": "e*******@findata.co",
            "intent_score": 88
        }
    ]
    
    return {"status": "success", "signals": mock_signals}

@router.post("/format-jd")
async def format_jd_and_source(req: JDFormatRequest, db: AsyncSession = Depends(get_db)):
    """
    Sourcing Hook (Phase 1): Takes a messy JD, formats it using a cheap LLM,
    and returns a 'Magic List' of 5 Silver Medalists from the Pinecone Data Lake.
    Candidate contact info is intentionally blurred.
    """
    log.info("plg_format_jd_requested")
    
    # 1. Format the JD (Mocked fast LLM execution)
    polished_jd = f"""
# Senior Role
**Overview:** We are looking for a highly skilled candidate based on your input.
**Core Requirements:**
- 5+ years experience
- Strong architecture skills
- Excellent communication

*(Polished by DVT Market IQ Agent in 1.2s)*
"""

    # 2. Query the Pinecone ATS Data Lake (Mocked for PLG)
    magic_list = [
        {
            "id": "cnd_1",
            "name": "Alex E.",
            "title": "Senior Software Engineer",
            "status": "Silver Medalist (Interviewed Oct 2025)",
            "email_blurred": "a****@gmail.com",
            "match_score": 96
        },
        {
            "id": "cnd_2",
            "name": "Jordan P.",
            "title": "Lead Developer",
            "status": "Silver Medalist (Offer Declined Jan 2026)",
            "email_blurred": "j******@yahoo.com",
            "match_score": 92
        },
        {
            "id": "cnd_3",
            "name": "Sam R.",
            "title": "Backend Architect",
            "status": "Silver Medalist (Interviewed Nov 2025)",
            "email_blurred": "s***@outlook.com",
            "match_score": 89
        }
    ]
    
    return {
        "status": "success",
        "polished_jd": polished_jd,
        "magic_list": magic_list,
        "math_reality_check": {
            "candidates_found": 50,
            "estimated_manual_hours": 5,
            "cost_of_time": "$750"
        }
    }
