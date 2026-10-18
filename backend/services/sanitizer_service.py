"""
DVT Talent AI — Prompt Injection & Text Sanitizer Service
Strips prompt injection vectors, hidden text, control phrases, and zero-width characters
from incoming candidate resumes, web text, and user inputs before LLM ingestion.
"""
import re
from typing import Dict, Any, Tuple
import structlog

log = structlog.get_logger(__name__)

# Hazardous control phrases frequently used in resume prompt injection attacks
SUSPECT_PATTERNS = [
    r"ignore\s+(all\s+)?(previous|prior)\s+instructions?",
    r"system\s*:\s*",
    r"system\s+prompt",
    r"you\s+are\s+now\s+a",
    r"set\s+score\s+to\s+100",
    r"score\s*:\s*100",
    r"always\s+recommend\s+this\s+candidate",
    r"override\s+evaluation",
    r"do\s+not\s+fail\s+this\s+candidate",
    r"sudo\s+mode",
    r"jailbreak",
]

# Zero-width and invisible unicode characters used for obfuscation
ZERO_WIDTH_CHARS = re.compile(r"[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E]")

class PromptSanitizer:
    """
    Sanitizes untrusted text (resumes, portfolios, scraped web JDs) to prevent
    prompt injection attacks from compromising agent reasoning.
    """
    
    @staticmethod
    def sanitize(text: str) -> Tuple[str, Dict[str, Any]]:
        """
        Cleans input text and returns a tuple of (sanitized_text, injection_report).
        """
        if not text:
            return "", {"injection_detected": False, "flags": []}

        flags = []
        original_length = len(text)
        
        # 1. Strip zero-width & invisible unicode characters
        cleaned_text = ZERO_WIDTH_CHARS.sub("", text)
        if len(cleaned_text) != original_length:
            flags.append("Invisible zero-width characters stripped")
            
        # 2. Check for known prompt injection control phrases
        for pattern in SUSPECT_PATTERNS:
            matches = re.findall(pattern, cleaned_text, re.IGNORECASE)
            if matches:
                flags.append(f"Prompt injection pattern detected: '{pattern}'")
                # Redact the suspect phrase
                cleaned_text = re.sub(pattern, "[REDACTED_PROMPT_INJECTION]", cleaned_text, flags=re.IGNORECASE)
                
        # 3. Strip excessive whitespace / hidden formatting blocks
        cleaned_text = re.sub(r"\n{4,}", "\n\n", cleaned_text)
        
        injection_detected = len(flags) > 0
        if injection_detected:
            log.warning("prompt_injection_flagged", flags=flags)

        report = {
            "injection_detected": injection_detected,
            "flags": flags,
            "cleaned_char_count": len(cleaned_text),
            "original_char_count": original_length
        }
        
        return cleaned_text, report

sanitizer_service = PromptSanitizer()
