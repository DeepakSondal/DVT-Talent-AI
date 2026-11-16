"""
DVT Talent AI — GDPR Article 17 Candidate PII Masking & Redaction Service
Provides redaction of PII (names, emails, phone numbers, addresses, SSNs)
before transmitting raw candidate resumes or text to external LLM providers.
Supports Microsoft Presidio when available with high-performance regex fallback.
"""
import re
from typing import Any, Dict, List, Tuple

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
PROFILE_URL_REGEX = re.compile(
    r"\b(?:www\.)?(?:linkedin\.com/(?:in|pub)/[A-Za-z0-9_.-]+|github\.com/[A-Za-z0-9_.-]+|(?:twitter|x)\.com/[A-Za-z0-9_]+)\b",
    re.IGNORECASE,
)
LABELED_ADDRESS_REGEX = re.compile(
    r"(?im)(?:^|(?<=\s))(?:Home\s+|Street\s+|Mailing\s+)?Address\s*:\s*[^\n\r|]+"
)
ADDRESS_REGEX = re.compile(
    r"\b\d{1,5}\s+(?:[A-Za-z0-9.'-]+\s+){1,4}(?:Street|St\.?|Avenue|Ave\.?|Boulevard|Blvd\.?|Road|Rd\.?|Drive|Dr\.?|Lane|Ln\.?|Court|Ct\.?|Circle|Cir\.?|Terrace|Ter\.?|Parkway|Pkwy\.?)\b(?:\s*,?\s*(?:Apt|Suite|Ste|Unit|#)\.?\s*[A-Za-z0-9-]+)?",
    re.IGNORECASE,
)
CITY_STATE_ZIP_REGEX = re.compile(r"\b[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2},\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?\b")
LABELED_NAME_REGEX = re.compile(
    r"(?im)(?:^|(?<=\s))(?:Full\s+Name|Candidate\s+Name)\s*:\s*[A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+){1,2}\b"
)


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

        # Mask URLs and social/developer profile links before numeric/contact rules
        urls = URL_REGEX.findall(masked)
        if urls:
            redactions += len(urls)
            entities_found.append("URL")
            masked = URL_REGEX.sub("[URL_REDACTED]", masked)

        profile_urls = PROFILE_URL_REGEX.findall(masked)
        if profile_urls:
            redactions += len(profile_urls)
            if "URL" not in entities_found:
                entities_found.append("URL")
            masked = PROFILE_URL_REGEX.sub("[URL_REDACTED]", masked)

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

        # Heuristic Street Address & Postal Location Redaction
        address_count = 0
        for addr_regex in (LABELED_ADDRESS_REGEX, ADDRESS_REGEX, CITY_STATE_ZIP_REGEX):
            matches = addr_regex.findall(masked)
            if matches:
                address_count += len(matches)
                masked = addr_regex.sub("[ADDRESS_REDACTED]", masked)
        if address_count:
            redactions += address_count
            entities_found.append("ADDRESS")

        # Heuristic Labeled Candidate Name Redaction
        labeled_names = LABELED_NAME_REGEX.findall(masked)
        if labeled_names:
            redactions += len(labeled_names)
            entities_found.append("PERSON")
            masked = LABELED_NAME_REGEX.sub("[NAME_REDACTED]", masked)

        return masked, {
            "redactions_count": redactions,
            "entities_found": entities_found,
            "engine": "regex"
        }


pii_service = PIIRedactionService()

