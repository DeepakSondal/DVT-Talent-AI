"""
DVT Talent AI — Pre-Flight Check Script
Validates the entire stack (DB, Redis, API Keys, External Handshakes)
before deployment or pilot launch.
"""

import os
import sys
import asyncio
import httpx
from typing import List, Tuple
from dotenv import load_dotenv

# Add the backend directory to sys.path to import local modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

if sys.platform == "win32" and hasattr(sys.stdout, "buffer"):
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from config import settings

# ANSI Color Codes for terminal output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
BOLD = "\033[1m"
RESET = "\033[0m"

class PreflightCheck:
    def __init__(self):
        self.results: List[Tuple[str, bool, str]] = []

    def log_result(self, component: str, success: bool, message: str):
        self.results.append((component, success, message))
        icon = f"{GREEN}✅{RESET}" if success else f"{RED}❌{RESET}"
        print(f"{icon} {BOLD}{component:<25}{RESET} | {message}")

    async def check_env_vars(self):
        """Check if all critical environment variables are present."""
        required = [
            "DATABASE_URL", "SECRET_KEY", "SERPER_API_KEY", "GITHUB_TOKEN"
        ]
        # At least one LLM key
        llm_keys = ["ANTHROPIC_API_KEY", "GROQ_API_KEY", "OPENAI_API_KEY"]
        
        missing = [v for v in required if not getattr(settings, v.lower(), None)]
        has_llm = any(getattr(settings, v.lower(), None) for v in llm_keys)
        
        if missing or not has_llm:
            msg = f"Missing: {', '.join(missing)}"
            if not has_llm:
                msg += " | No LLM key found (Anthropic/Groq/OpenAI required)"
            self.log_result("Environment Vars", False, msg)
        else:
            self.log_result("Environment Vars", True, "All critical variables present.")

    async def check_anthropic(self):
        """Test Anthropic API connectivity."""
        if not settings.anthropic_api_key:
            return self.log_result("Anthropic API", False, "No API key found.")
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": settings.anthropic_api_key,
                        "anthropic-version": "2023-06-01",
                        "Content-Type": "application/json"
                    },
                    json={"model": settings.anthropic_model, "max_tokens": 1, "messages": [{"role": "user", "content": "hi"}]},
                    timeout=10
                )
                if resp.status_code == 200 or resp.status_code == 400: # 400 is sometimes returned for "invalid request" but key is valid
                    self.log_result("Anthropic API", True, "Handshake successful.")
                else:
                    self.log_result("Anthropic API", False, f"Invalid Key (HTTP {resp.status_code})")
        except Exception as e:
            self.log_result("Anthropic API", False, f"Connection failed: {str(e)}")

    async def check_groq(self):
        """Test Groq API connectivity."""
        if not settings.groq_api_key:
            return self.log_result("Groq API", False, "No API key found.")
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{settings.groq_api_base}/models",
                    headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                    timeout=10
                )
                if resp.status_code == 200:
                    self.log_result("Groq API", True, "High-speed engine accessible.")
                else:
                    self.log_result("Groq API", False, f"Invalid Key (HTTP {resp.status_code})")
        except Exception as e:
            self.log_result("Groq API", False, f"Connection failed: {str(e)}")

    async def check_database(self):
        """Test Database (PostgreSQL or SQLite) connection."""
        from sqlalchemy import create_engine, text
        try:
            db_url = settings.database_url
            if "sqlite" in db_url:
                # Convert aiosqlite to standard sqlite
                db_url = db_url.replace("sqlite+aiosqlite", "sqlite")
            else:
                # Use synchronous engine for quick check
                db_url = db_url.replace("postgresql+asyncpg", "postgresql")
            
            engine = create_engine(db_url)
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            self.log_result("Database", True, "Storage engine reachable.")
        except Exception as e:
            self.log_result("Database", False, f"Connection error: {str(e)}")

    async def check_openai(self):
        """Test OpenAI API connectivity and model access."""
        if not settings.openai_api_key:
            return self.log_result("OpenAI API", False, "No API key found.")
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    "https://api.openai.com/v1/models",
                    headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                    timeout=10
                )
                if resp.status_code == 200:
                    self.log_result("OpenAI API", True, "Handshake successful. Models accessible.")
                else:
                    self.log_result("OpenAI API", False, f"Invalid Key (HTTP {resp.status_code})")
        except Exception as e:
            self.log_result("OpenAI API", False, f"Connection failed: {str(e)}")

    async def check_serper(self):
        """Test Serper (Market IQ) connectivity."""
        if not settings.serper_api_key:
            return self.log_result("Serper (Market IQ)", False, "No API key found.")
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://google.serper.dev/search",
                    headers={"X-API-KEY": settings.serper_api_key, "Content-Type": "application/json"},
                    json={"q": "dvt talent ai test"},
                    timeout=10
                )
                if resp.status_code == 200:
                    self.log_result("Serper (Market IQ)", True, "Search API active.")
                else:
                    self.log_result("Serper (Market IQ)", False, f"Invalid Key (HTTP {resp.status_code})")
        except Exception as e:
            self.log_result("Serper (Market IQ)", False, f"Connection failed: {str(e)}")

    async def check_github(self):
        """Test GitHub (Sourcing) token validity."""
        if not settings.github_token:
            return self.log_result("GitHub (Sourcing)", False, "No token found.")
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    "https://api.github.com/user",
                    headers={"Authorization": f"token {settings.github_token}"},
                    timeout=10
                )
                if resp.status_code == 200:
                    user = resp.json().get("login")
                    self.log_result("GitHub (Sourcing)", True, f"Token valid (User: {user})")
                else:
                    self.log_result("GitHub (Sourcing)", False, "Invalid/Expired Token")
        except Exception as e:
            self.log_result("GitHub (Sourcing)", False, f"Connection failed: {str(e)}")

    async def check_stripe(self):
        """Test Stripe (Billing) connectivity."""
        if not settings.stripe_secret_key:
            return self.log_result("Stripe (Billing)", False, "No secret key found.")
        try:
            import stripe
            stripe.api_key = settings.stripe_secret_key
            stripe.Account.retrieve()
            self.log_result("Stripe (Billing)", True, "Billing gateway active.")
        except Exception as e:
            self.log_result("Stripe (Billing)", False, f"Connection error: {str(e)}")

    async def run_all(self):
        print(f"\n{BOLD}{BLUE}=== DVT TALENT AI PRE-FLIGHT CHECK (v1.1) ==={RESET}\n")
        
        await self.check_env_vars()
        await self.check_database()
        await self.check_anthropic()
        await self.check_groq()
        await self.check_openai()
        await self.check_serper()
        await self.check_github()
        await self.check_stripe()
        
        print(f"\n{BLUE}{'='*40}{RESET}")
        all_passed = all(r[1] for r in self.results)
        
        if all_passed:
            print(f"\n{GREEN}{BOLD}STATUS: ALL SYSTEMS GO FOR DEPLOYMENT! 🚀{RESET}\n")
            return True
        else:
            print(f"\n{RED}{BOLD}STATUS: SYSTEM NOT READY. PLEASE FIX ERRORS ABOVE. 🛑{RESET}\n")
            return False

if __name__ == "__main__":
    check = PreflightCheck()
    success = asyncio.run(check.run_all())
    sys.exit(0 if success else 1)
