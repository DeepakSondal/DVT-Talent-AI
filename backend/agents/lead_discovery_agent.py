"""
DVT Talent AI — Lead Discovery Agent
Finds HR/Engineering decision makers at target companies.
Identifies VPs of Engineering, CTOs, HR Directors, Technical Recruiters.
"""
import json
from typing import Dict, List, Any, Optional

from agents.base_agent import BaseAgent


SYSTEM_PROMPT = """You are a Lead Discovery Agent for DVT Talent AI.
Your mission is to find HR and engineering decision makers at companies.

Target personas (in priority order):
1. VP of Engineering / Director of Engineering
2. CTO / VP of Technology
3. Head of Talent / VP of People
4. Engineering Manager
5. Technical Recruiter / Head of Recruiting

For each contact, estimate:
- Full name
- Job title
- Email (guess pattern: firstname@company.com, first.last@company.com)
- LinkedIn URL pattern
- Is this a decision maker? (yes if title includes Director, VP, Head, Chief, Manager)
- Confidence score (0-100)

Return ONLY valid JSON. No extra text."""


class LeadDiscoveryAgent(BaseAgent):
    """
    Discovers decision makers at target companies by:
    1. Searching LinkedIn for people by title + company
    2. Scraping company "About" / "Team" pages
    3. Searching Twitter/X for technical leaders
    4. Cross-referencing GitHub org members
    """

    def __init__(self):
        super().__init__(
            name="lead_discovery",
            description="Finds HR and engineering decision makers at target companies",
        )

    def run(self, company_name: str, company_domain: str, limit: int = 5) -> Dict[str, Any]:
        self.log_start(f"Finding decision makers at {company_name}")
        contacts = []

        try:
            # Multi-source search strategy
            search_results = []

            # Search 1: LinkedIn people search
            linkedin_results = self.search_web(
                f'site:linkedin.com/in "{company_name}" '
                f'("VP Engineering" OR "CTO" OR "Head of Talent" OR "Director Engineering" OR "Head of Recruiting")',
                num_results=10,
            )
            search_results.extend(linkedin_results)

            # Search 2: Company website team page
            team_results = self.search_web(
                f'site:{company_domain} "team" OR "leadership" OR "about-us"',
                num_results=5,
            )
            search_results.extend(team_results)

            # Search 3: General web search for company leaders
            general_results = self.search_web(
                f'"{company_name}" "VP of Engineering" OR "CTO" OR "Head of Talent" email',
                num_results=5,
            )
            search_results.extend(general_results)

            if search_results:
                contacts = self._extract_contacts_with_ai(
                    search_results, company_name, company_domain, limit
                )

        except Exception as e:
            self.log_error(e)

        self.log_complete(f"Found {len(contacts)} decision makers at {company_name}")
        return {"contacts": contacts, "company_name": company_name}

    def _extract_contacts_with_ai(
        self,
        results: List[dict],
        company_name: str,
        company_domain: str,
        limit: int,
    ) -> List[dict]:
        snippets = "\n\n".join([
            f"Title: {r.get('title', '')}\nURL: {r.get('link', '')}\nSnippet: {r.get('snippet', '')}"
            for r in results[:15]
        ])

        user_prompt = f"""Find up to {limit} HR/Engineering decision makers at {company_name} ({company_domain}).

Search results:
{snippets}

Return JSON:
{{
  "contacts": [
    {{
      "first_name": "Jane",
      "last_name": "Smith",
      "title": "VP of Engineering",
      "department": "Engineering",
      "seniority": "VP",
      "linkedin_url": "https://linkedin.com/in/janesmith",
      "email": "jane.smith@{company_domain}",
      "is_decision_maker": true,
      "confidence": 85,
      "source": "linkedin"
    }}
  ]
}}"""

        try:
            response = self.chat(SYSTEM_PROMPT, user_prompt, json_mode=True, temperature=0.1)
            data = json.loads(response)
            return data.get("contacts", [])
        except Exception as e:
            self.log.warning("contact_extraction_failed", error=str(e))
            return []

    def verify_email(self, email: str) -> Dict[str, Any]:
        """Basic email format validation (extend with Hunter.io or similar)"""
        import re
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        is_valid = bool(re.match(pattern, email))
        return {
            "email": email,
            "is_valid_format": is_valid,
            "verification_method": "regex",
        }

    def find_github_org_members(self, org_name: str) -> List[dict]:
        """Find technical leads via GitHub org membership"""
        import httpx
        # FIX [C-03]: was self.config.github_token (AttributeError) → settings.github_token
        if not settings.github_token:
            self.log.warning("github_token_missing", msg="GitHub org search skipped")
            return []
        headers = {"Authorization": f"token {settings.github_token}"}
        with httpx.Client(timeout=30) as client:
            resp = client.get(
                f"https://api.github.com/orgs/{org_name}/members",
                headers=headers,
                params={"per_page": 30},
            )
            if resp.status_code != 200:
                return []
            members = resp.json()
            return [{"login": m["login"], "github_url": m["html_url"]} for m in members]
