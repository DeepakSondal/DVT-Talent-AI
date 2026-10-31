"""
DVT Talent AI — GDPR Article 17 Candidate PII Masking & Redaction Service
Provides redaction of PII (names, emails, phone numbers, addresses, SSNs)
before transmitting raw candidate resumes or text to external LLM providers.
Supports Microsoft Presidio when available with high-performance regex fallback.
"""
import re
from typing import Dict, Any, Tuple, List
import structlog

log = structlog.get_logger(__name__)

# Optional Presidio Engine Integration
try:
    from presidio_analyzer import AnalyzerEngine
    from presidio_anonymizer import AnonymizerEngine
    from presidio_anonymizer.entities import OperatorConfig
    PRESIDIO_AVAILABLE = True
    _analyzer = AnalyzerEngine()
    _anonymizer = AnonymizerEngine()
except Exception:
    PRESIDIO_AVAILABLE = False
    _analyzer = None
    _anonymizer = None

# Comprehensive Regex Fallbacks for Sensitive PII
EMAIL_REGEX = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b")
PHONE_REGEX = re.compile(r"(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b")
SSN_REGEX = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")
URL_REGEX = re.compile(r"https?://(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b[-a-zA-Z0-9()@:%_+.~#?&/=]*")


class PIIRedactionService:
    """
    Enforces GDPR Data Minimization by stripping direct candidate identifiers
    prior to sending prompt payloads to external LLM providers.
    """

    @classmethod
    def mask_pii(cls, text: str) -> Tuple[str, Dict[str, Any]]:
        """
        Masks candidate PII and returns (masked_text, redaction_metadata).
        """
        if not text:
            return "", {"redactions_count": 0, "entities_found": []}

        # 1. Presidio path if available and configured
        if PRESIDIO_AVAILABLE and _analyzer and _anonymizer:
            try:
                results = _analyzer.analyze(
                    text=text,
                    entities=["EMAIL_ADDRESS", "PHONE_NUMBER", "PERSON", "US_SSN", "LOCATION"],
                    language="en"
                )
                if results:
                    anonymized_result = _anonymizer.anonymize(
                        text=text,
                        analyzer_results=results,
                        operators={"DEFAULT": OperatorConfig("replace", {"new_value": "[PII_REDACTED]"})}
                    )
                    entities = list({r.entity_type for r in results})
                    return anonymized_result.text, {
                        "redactions_count": len(results),
                        "entities_found": entities,
                        "engine": "presidio"
                    }
            except Exception as e:
                log.warning("presidio_redaction_failed_using_regex_fallback", error=str(e))

        # 2. Resilient Regex Fallback
        masked = text
        entities_found: List[str] = []
        redactions = 0

        # Mask Emails
        emails = EMAIL_REGEX.findall(masked)
        if emails:
            redactions += len(emails)
            entities_found.append("EMAIL")
            masked = EMAIL_REGEX.sub("[EMAIL_REDACTED]", masked)

        # Mask Phone Numbers
        phones = PHONE_REGEX.findall(masked)
        if phones:
            redactions += len(phones)
            entities_found.append("PHONE")
            masked = PHONE_REGEX.sub("[PHONE_REDACTED]", masked)

        # Mask SSNs
        ssns = SSN_REGEX.findall(masked)
        if ssns:
            redactions += len(ssns)
            entities_found.append("SSN")
            masked = SSN_REGEX.sub("[SSN_REDACTED]", masked)

        return masked, {
            "redactions_count": redactions,
            "entities_found": entities_found,
            "engine": "regex"
        }


pii_service = PIIRedactionService()
