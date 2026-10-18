"""
DVT Talent AI — Pre-Flight Validation & Email Health Service
Performs email syntax verification, disposable email provider detection,
and phone E.164 normalization before handoff to outreach or voice screening agents.
"""
import re
from typing import Dict, Any, Optional
import structlog

log = structlog.get_logger(__name__)

# List of common disposable/temporary email provider domains
DISPOSABLE_DOMAINS = {
    "mailinator.com", "tempmail.com", "10minutemail.com", "guerrillamail.com",
    "sharklasers.com", "yopmail.com", "trashmail.com", "dispostable.com"
}

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
PHONE_REGEX = re.compile(r"^\+?[1-9]\d{1,14}$")

class ValidationService:
    """
    Validates candidate contact details to ensure delivery health and prevent email bounces.
    """
    
    @staticmethod
    def validate_email(email: str) -> Dict[str, Any]:
        """
        Validates email format and flags disposable or invalid domains.
        """
        if not email or not isinstance(email, str):
            return {"valid": False, "reason": "Missing or non-string email"}

        clean_email = email.strip().lower()
        
        # 1. Format check
        if not EMAIL_REGEX.match(clean_email):
            return {"valid": False, "reason": "Invalid email syntax format"}
            
        domain = clean_email.split("@")[-1]
        
        # 2. Disposable domain check
        if domain in DISPOSABLE_DOMAINS:
            return {"valid": False, "reason": f"Disposable domain detected ({domain})", "disposable": True}
            
        return {
            "valid": True,
            "email": clean_email,
            "domain": domain,
            "disposable": False
        }

    @staticmethod
    def normalize_phone(phone: str, default_country_code: str = "+1") -> Optional[str]:
        """
        Normalizes phone numbers to international E.164 standard (+14155552671).
        """
        if not phone:
            return None
            
        # Strip all non-digit characters except leading +
        digits_only = re.sub(r"[^\d+]", "", phone.strip())
        
        if not digits_only:
            return None
            
        if not digits_only.startswith("+"):
            digits_only = f"{default_country_code}{digits_only}"
            
        if PHONE_REGEX.match(digits_only):
            return digits_only
            
        return None

validation_service = ValidationService()
