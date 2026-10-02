import structlog
import os
import httpx
from typing import Dict, Any

log = structlog.get_logger(__name__)

async def trigger_vapi_outbound_call(
    candidate_name: str,
    candidate_phone: str,
    screening_plan: Dict[str, Any],
    vapi_api_key: str
) -> str:
    """
    Triggers an outbound phone call to the candidate using Vapi.ai's outbound call API.
    The screening plan is passed as the system prompt to the voice agent.
    """
    url = "https://api.vapi.ai/call/phone"
    headers = {
        "Authorization": f"Bearer {vapi_api_key}",
        "Content-Type": "application/json"
    }
    
    # We construct a system prompt for the voice agent based on the screening plan
    questions_text = "\n".join([f"- {q.get('question', '')}" for q in screening_plan.get("questions", [])])
    
    system_prompt = (
        f"You are an AI Technical Screener for DVT Talent AI. You are calling {candidate_name}. "
        f"Your goal is to conduct a professional, friendly 10-minute technical interview. "
        f"Please ask the following questions one by one, listening carefully to their answers:\n{questions_text}\n"
        f"Be conversational and react to their answers dynamically. End the call when finished."
    )
    
    payload = {
        "phoneNumberId": "default_dvt_phone_id", # Replace with actual provisioned number ID
        "customer": {
            "number": candidate_phone,
            "name": candidate_name
        },
        "assistant": {
            "firstMessage": f"Hi {candidate_name}, this is the DVT Talent AI assistant. Are you ready for your technical screen?",
            "model": {
                "provider": "openai",
                "model": "gpt-4o-realtime-preview",
                "systemPrompt": system_prompt
            },
            "voice": {
                "provider": "11labs",
                "voiceId": "eleven_monolingual_v1" # example
            }
        }
    }
    
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code in (200, 201):
                call_data = resp.json()
                log.info("outbound_voice_call_triggered", call_id=call_data.get("id"))
                return f"Successfully triggered voice call to {candidate_phone}. Call ID: {call_data.get('id')}"
            else:
                log.error("vapi_call_failed", status=resp.status_code, error=resp.text)
                return f"Failed to trigger call. API returned {resp.status_code}: {resp.text}"
    except Exception as e:
        log.error("vapi_call_exception", error=str(e))
        return f"Exception while triggering call: {str(e)}"
