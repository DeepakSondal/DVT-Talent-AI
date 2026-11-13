"""
DVT Talent AI — Multi-Format Resume Parser & Document Service
Extracts full text and structured career data from PDF, DOCX, and TXT resumes.
"""
import sys

if __name__.startswith("backend.services."):
    sys.modules[__name__.replace("backend.services.", "services.")] = sys.modules[__name__]
elif __name__.startswith("services."):
    sys.modules["backend." + __name__] = sys.modules[__name__]

import io
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import structlog

logger = structlog.get_logger(__name__)


class UnsupportedResumeFormatError(ValueError):
    """Raised when a binary resume format (e.g. legacy OLE2 .doc) cannot be extracted."""

def get_upload_dir() -> Path:
    try:
        from config import settings
        base = Path(getattr(settings, "upload_dir", Path(__file__).resolve().parent.parent / "uploads"))
    except Exception:
        base = Path(__file__).resolve().parent.parent / "uploads"
    return base / "resumes"


UPLOAD_DIR = get_upload_dir()


def _compile_skill_matchers(
    catalog: Tuple[str, ...],
    synonyms: Dict[str, str],
) -> Tuple[Tuple[re.Pattern[str], str], ...]:
    seen: Dict[str, Tuple[re.Pattern[str], str]] = {}
    for skill in catalog:
        key = skill.lower()
        canonical = synonyms.get(key, skill)
        if key not in seen:
            seen[key] = (
                re.compile(rf"(?<![a-zA-Z0-9]){re.escape(key)}(?![a-zA-Z0-9])"),
                canonical,
            )
    for alias, canonical in synonyms.items():
        key = alias.lower()
        if key not in seen:
            seen[key] = (
                re.compile(rf"(?<![a-zA-Z0-9]){re.escape(key)}(?![a-zA-Z0-9])"),
                canonical,
            )
    return tuple(seen.values())


class ResumeParserService:
    """Enterprise multi-format resume parsing and document extraction service."""

    @classmethod
    def ensure_upload_dir(cls) -> Path:
        """Ensure the local resume storage directory exists."""
        upload_dir = get_upload_dir()
        upload_dir.mkdir(parents=True, exist_ok=True)
        # Create .gitignore inside uploads to avoid committing candidate resumes
        gitignore = upload_dir.parent / ".gitignore"
        if not gitignore.exists():
            try:
                gitignore.write_text("*\n!.gitignore\n", encoding="utf-8")
            except Exception:  # noqa: S110
                pass
        return upload_dir

    @classmethod
    def save_resume_file(
        cls, candidate_id: str, resume_id: str, filename: str, content_bytes: bytes
    ) -> str:
        """
        Securely persist resume file to the uploads directory.
        Returns the relative path for database storage.
        """
        upload_path = cls.ensure_upload_dir()
        
        # Sanitize extension and base name, stripping any directory components or null bytes
        clean_filename = os.path.basename((filename or "resume.pdf").replace("\x00", "").replace("\\", "/"))
        ext = ("." + clean_filename.rsplit(".", 1)[-1].lower()) if "." in clean_filename else ".pdf"
        allowed_exts = {".pdf", ".docx", ".doc", ".txt", ".rtf"}
        if ext not in allowed_exts:
            ext = ".pdf"
        base_stem = clean_filename.rsplit(".", 1)[0] if "." in clean_filename else clean_filename
        sanitized_stem = re.sub(r"[^a-zA-Z0-9_-]", "_", base_stem)[:80].strip("_") or "resume"
        safe_filename = f"{candidate_id}_{resume_id}_{sanitized_stem}{ext}"
        
        target_path = (upload_path / safe_filename).resolve()
        if not target_path.is_relative_to(upload_path.resolve()):
            raise ValueError("Invalid resume file destination")
        target_path.write_bytes(content_bytes)
        logger.info("resume_file_saved", filename=safe_filename, bytes=len(content_bytes))
        
        return str(target_path)

    @classmethod
    def get_resume_file_path(cls, file_url: Optional[str], base_dir: Optional[Path] = None) -> Optional[Path]:
        """
        Safely retrieve the physical path of an uploaded resume.
        Protects against directory traversal, absolute path injection,
        null-byte attacks, and symlink-based escapes.
        """
        if not file_url or not isinstance(file_url, str):
            return None

        raw = file_url.strip()
        if not raw or "\x00" in raw:
            return None

        allowed_exts = {".pdf", ".docx", ".doc", ".txt", ".rtf"}

        try:
            upload_root = (base_dir or cls.ensure_upload_dir()).resolve()

            p = Path(raw)
            if p.is_absolute():
                resolved_path = p.resolve()
            else:
                resolved_path = (upload_root / p).resolve()

            # Enforce strict containment within upload_root
            if not resolved_path.is_relative_to(upload_root) or resolved_path == upload_root:
                logger.warning("resume_path_traversal_blocked", requested=raw)
                return None

            if not resolved_path.is_file():
                return None

            if resolved_path.suffix.lower() not in allowed_exts:
                logger.warning("resume_path_unauthorized_extension", requested=raw, ext=resolved_path.suffix)
                return None

            return resolved_path
        except (ValueError, RuntimeError, OSError) as err:
            logger.warning("resume_path_resolution_error", error=str(err))
            return None

    MAX_PDF_PAGES = 50
    MAX_DOCX_UNCOMPRESSED_BYTES = 25 * 1024 * 1024  # 25 MB zip-bomb cap
    MAX_EXTRACTED_CHARS = 100_000

    @classmethod
    def _extract_with_docling(cls, content_bytes: bytes, filename: str) -> Optional[str]:
        """
        Attempts high-fidelity layout-aware parsing via Docling if installed.
        Returns extracted markdown or None if Docling is unavailable or fails.
        """
        try:
            import tempfile

            from docling.document_converter import DocumentConverter
            ext = ("." + filename.rsplit(".", 1)[-1].lower()) if "." in filename else ".pdf"
            with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
                tmp.write(content_bytes)
                tmp_path = Path(tmp.name)
            try:
                converter = DocumentConverter()
                result = converter.convert(tmp_path)
                md = result.document.export_to_markdown()
                if md and md.strip():
                    logger.info("docling_layout_extracted", chars=len(md))
                    return md
            finally:
                if tmp_path.exists():
                    tmp_path.unlink()
        except Exception:  # noqa: S110
            # Docling not installed or conversion skipped; fallback smoothly
            pass
        return None

    @classmethod
    def extract_text(cls, content_bytes: bytes, filename: str) -> str:
        """
        Extract complete text from PDF, DOCX, or TXT file bytes with resource-exhaustion
        and prompt-injection sanitization safeguards.
        """
        ext = ("." + filename.rsplit(".", 1)[-1].lower()) if "." in filename else ""
        text = ""

        # Reject known executable / archive binary magic headers disguised with document extensions
        if content_bytes.startswith((b"MZ", b"\x7fELF", b"\xca\xfe\xba\xbe", b"#!/")):
            logger.warning("resume_executable_signature_blocked", filename=filename)
            return ""

        # 0. High-fidelity Docling layout parsing (if available)
        docling_text = cls._extract_with_docling(content_bytes, filename)
        if docling_text:
            text = docling_text

        # 1. PDF Extraction
        elif ext == ".pdf":
            text = cls._extract_from_pdf(content_bytes)
            
        # 2. Word (DOCX) Extraction — handle OOXML .docx and legacy binary OLE2 .doc
        elif ext == ".docx" or (ext == ".doc" and content_bytes.startswith(b"PK\x03\x04")):
            text = cls._extract_from_docx(content_bytes)
        elif ext == ".doc" and content_bytes.startswith(b"\xd0\xcf\x11\xe0"):
            text = cls._extract_from_legacy_doc(content_bytes)
            
        # 3. Plain Text / Fallback (only if not a failed binary container like %PDF, PK zip, or OLE2 .doc)
        if not text.strip() and not content_bytes.startswith((b"%PDF", b"PK\x03\x04", b"\xd0\xcf\x11\xe0")):
            text = cls._extract_from_plain_text(content_bytes)

        # Normalize line endings, sanitize prompt injection vectors, and bound size
        clean_text = cls._clean_text(text)
        clean_text = re.sub(r"<\s*script[^>]*>.*?<\s*/\s*script\s*>", "", clean_text, flags=re.IGNORECASE | re.DOTALL)
        clean_text = re.sub(r"<\s*/?\s*script[^>]*>", "", clean_text, flags=re.IGNORECASE)
        try:
            from services.sanitizer_service import sanitizer_service
            sanitized_result = sanitizer_service.sanitize(clean_text)
            clean_text = sanitized_result[0] if isinstance(sanitized_result, tuple) else sanitized_result
        except Exception as exc:
            logger.debug("sanitizer_fallback_skipped", error=str(exc))
        return clean_text[:cls.MAX_EXTRACTED_CHARS]

    @classmethod
    def extract_anonymized_text(cls, content_bytes: bytes, filename: str) -> Tuple[str, Dict[str, Any]]:
        """
        Extracts resume text and strips candidate PII under GDPR Article 17 prior to LLM routing.
        Fails closed unless settings.allow_unredacted_pii_waiver is explicitly enabled.
        """
        raw_clean = cls.extract_text(content_bytes, filename)
        try:
            from services.pii_service import pii_service
            return pii_service.mask_pii(raw_clean)
        except Exception as e:
            from config import settings
            if getattr(settings, "allow_unredacted_pii_waiver", False):
                logger.warning("pii_masking_waiver_bypass_active", error=str(e), filename=filename)
                return raw_clean, {"redactions_count": 0, "entities_found": [], "engine": "waiver_bypass"}
            logger.error("pii_masking_failed_aborting", error=str(e), filename=filename)
            raise RuntimeError("PII masking failed; aborting unredacted resume processing") from e

    @classmethod
    def _extract_from_pdf(cls, content_bytes: bytes) -> str:
        """Extract text from PDF using pypdf with page count bounds."""
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(content_bytes))
            total_pages = len(reader.pages)
            if total_pages > cls.MAX_PDF_PAGES:
                logger.warning("pdf_page_limit_exceeded", total_pages=total_pages, max_pages=cls.MAX_PDF_PAGES)
            pages_text = []
            for i in range(min(total_pages, cls.MAX_PDF_PAGES)):
                page_content = reader.pages[i].extract_text() or ""
                if page_content.strip():
                    pages_text.append(page_content)
            
            extracted = "\n\n".join(pages_text)
            if extracted.strip():
                logger.info("pdf_text_extracted", pages=min(total_pages, cls.MAX_PDF_PAGES), chars=len(extracted))
                return extracted
        except Exception as e:
            logger.warning("pypdf_extraction_failed", error=str(e))
        return ""

    @classmethod
    def _extract_from_legacy_doc(cls, content_bytes: bytes) -> str:
        """Extract text from legacy OLE2 .doc using LibreOffice (soffice) or antiword, else fail explicitly."""
        soffice_bin = shutil.which("soffice") or shutil.which("libreoffice")
        antiword_bin = shutil.which("antiword")
        if not soffice_bin and not antiword_bin:
            raise UnsupportedResumeFormatError(
                "Legacy binary .doc format requires LibreOffice (soffice) or antiword; please convert to .docx or .pdf."
            )

        with tempfile.TemporaryDirectory() as tmpdir:
            doc_path = Path(tmpdir) / "resume.doc"
            doc_path.write_bytes(content_bytes)

            if soffice_bin:
                proc = subprocess.run(  # noqa: S603
                    [soffice_bin, "--headless", "--convert-to", "txt:Text", "--outdir", tmpdir, str(doc_path)],
                    capture_output=True,
                    text=True,
                    timeout=20,
                    check=False,
                )
                txt_path = Path(tmpdir) / "resume.txt"
                if proc.returncode == 0 and txt_path.exists():
                    extracted = txt_path.read_text(encoding="utf-8", errors="replace")
                    if extracted.strip():
                        return extracted

            if antiword_bin:
                proc = subprocess.run(  # noqa: S603
                    [antiword_bin, str(doc_path)],
                    capture_output=True,
                    text=True,
                    timeout=15,
                    check=False,
                )
                if proc.returncode == 0 and proc.stdout.strip():
                    return proc.stdout

        raise UnsupportedResumeFormatError(
            "Unable to extract text from legacy binary .doc file; please convert to .docx or .pdf."
        )

    @classmethod
    def _extract_from_docx(cls, content_bytes: bytes) -> str:
        """Extract text from Word .docx file using python-docx with zip-bomb inspection."""
        try:
            import zipfile

            import docx
            if content_bytes.startswith(b"PK\x03\x04"):
                with zipfile.ZipFile(io.BytesIO(content_bytes)) as zf:
                    total_uncompressed = sum(info.file_size for info in zf.infolist())
                    if total_uncompressed > cls.MAX_DOCX_UNCOMPRESSED_BYTES or len(zf.infolist()) > 500:
                        logger.warning("docx_zip_bomb_blocked", uncompressed_bytes=total_uncompressed, entries=len(zf.infolist()))
                        return ""
            doc = docx.Document(io.BytesIO(content_bytes))
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            
            # Also extract text from any tables in the document
            for table in doc.tables:
                for row in table.rows:
                    row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
                    if row_text:
                        paragraphs.append(row_text)
                        
            extracted = "\n".join(paragraphs)
            if extracted.strip():
                logger.info("docx_text_extracted", paragraphs=len(paragraphs), chars=len(extracted))
                return extracted
        except Exception as e:
            logger.warning("docx_extraction_failed", error=str(e))
        return ""

    @classmethod
    def _extract_from_plain_text(cls, content_bytes: bytes) -> str:
        """Decode plain text using common encodings."""
        for encoding in ("utf-8", "latin-1", "cp1252", "utf-16"):
            try:
                decoded = content_bytes.decode(encoding)
                if decoded.strip():
                    return decoded
            except Exception:  # noqa: S112
                continue
        return content_bytes.decode("utf-8", errors="ignore")

    @classmethod
    def _clean_text(cls, text: str) -> str:
        """Clean and normalize extracted resume text."""
        # Remove null characters and control codes
        text = text.replace("\x00", "")
        # Normalize carriage returns
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        # Collapse excessive blank lines
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    @classmethod
    def parse_structured_resume(cls, raw_text: str, filename: str = "") -> Dict[str, Any]:
        """
        Perform structured career analysis on resume text:
        - Contact details (email, phone, links, location)
        - Section breakdown
        - Work experience timeline (company, title, dates, bullets)
        - Education history (institution, degree, year)
        - Skills catalog
        - Executive career summary
        """
        contact = cls._extract_contact_info(raw_text)
        sections = cls._segment_sections(raw_text)
        skills = cls._extract_skills(raw_text, sections)
        experience = cls._extract_experience(sections.get("experience", "") or raw_text)
        education = cls._extract_education(sections.get("education", "") or raw_text)
        summary = sections.get("summary", "") or cls._extract_initial_summary(raw_text)
        years_exp = cls._estimate_experience_years(experience, raw_text)

        current_company = experience[0]["company"] if experience else "Parsed From Resume"
        current_title = experience[0]["title"] if experience else "Technical Specialist"

        return {
            "contact": contact,
            "summary": summary,
            "skills": skills,
            "experience": experience,
            "education": education,
            "experience_years": years_exp,
            "current_company": current_company,
            "current_title": current_title,
            "section_names": list(sections.keys()),
            "raw_text_length": len(raw_text),
            "file_name": filename,
        }

    @classmethod
    def _extract_contact_info(cls, text: str) -> Dict[str, Any]:
        """Extract email, phone, location, LinkedIn, and GitHub links."""
        # Email
        email_match = re.search(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", text)
        email = email_match.group(0) if email_match else ""

        # Phone
        phone_match = re.search(
            r"(\+?\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}", text
        )
        phone = phone_match.group(0).strip() if phone_match else ""

        # LinkedIn
        linkedin_match = re.search(
            r"(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:in|profile)\/([a-zA-Z0-9_\-]+)", text, re.IGNORECASE
        )
        linkedin_url = f"https://linkedin.com/in/{linkedin_match.group(1)}" if linkedin_match else ""

        # GitHub
        github_match = re.search(
            r"(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_\-]+)", text, re.IGNORECASE
        )
        github_url = f"https://github.com/{github_match.group(1)}" if github_match else ""

        # Location heuristic
        location = ""
        loc_match = re.search(
            r"(?:Location|Address|Based in|Residing in)?[:\s]*([A-Z][a-zA-Z\s]+,\s*[A-Z]{2}(?:\s+\d{5})?|[A-Z][a-zA-Z\s]+,\s*[A-Z][a-zA-Z\s]+)",
            text[:1000]
        )
        if loc_match:
            location = loc_match.group(1).strip()
        elif "Remote" in text[:500]:
            location = "Remote"

        # Name heuristic: First line often contains the candidate's full name if it's 2-4 words and doesn't contain digits or colon
        first_name = ""
        last_name = ""
        for line in text.strip().splitlines()[:5]:
            clean_l = line.strip()
            if not clean_l or len(clean_l) > 50 or ":" in clean_l or "@" in clean_l or "http" in clean_l or "|" in clean_l:
                continue
            words = [w for w in clean_l.split() if w.isalpha()]
            if 2 <= len(words) <= 4:
                first_name = words[0].capitalize()
                last_name = " ".join(words[1:]).title()
                break

        return {
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "phone": phone,
            "linkedin_url": linkedin_url,
            "github_url": github_url,
            "location": location,
        }

    @classmethod
    def _segment_sections(cls, text: str) -> Dict[str, str]:
        """Split text into standardized resume sections based on common headings."""
        section_headers = {
            "summary": [r"summary", r"professional summary", r"executive summary", r"about me", r"objective"],
            "experience": [r"experience", r"work experience", r"employment history", r"professional experience", r"career history"],
            "education": [r"education", r"academic background", r"academic qualifications"],
            "skills": [r"skills", r"technical skills", r"core competencies", r"technologies", r"skill matrix"],
            "certifications": [r"certifications", r"certificates", r"licenses", r"credentials"],
            "projects": [r"projects", r"personal projects", r"key projects"],
        }

        # Build regex pattern for headers at start of line
        all_header_patterns = []
        for sec, patterns in section_headers.items():
            for p in patterns:
                all_header_patterns.append((sec, rf"(?mi)^[ \t]*(?:#+\s*)?({p})[: \t]*$"))

        sections: Dict[str, str] = {}
        splits: List[Tuple[int, str]] = []

        for sec_name, pattern in all_header_patterns:
            for match in re.finditer(pattern, text):
                splits.append((match.start(), sec_name))

        splits.sort(key=lambda x: x[0])

        if not splits:
            return {}

        for i, (start_pos, sec_name) in enumerate(splits):
            end_pos = splits[i + 1][0] if i + 1 < len(splits) else len(text)
            content = text[start_pos:end_pos].strip()
            # Remove the header line from the section content
            lines = content.split("\n", 1)
            body = lines[1].strip() if len(lines) > 1 else ""
            if sec_name not in sections:
                sections[sec_name] = body
            else:
                sections[sec_name] += "\n\n" + body

        return sections

    _SKILL_SYNONYMS: Dict[str, str] = {
        "golang": "Go",
        "go-lang": "Go",
        "k8s": "Kubernetes",
        "kube": "Kubernetes",
        "postgres": "PostgreSQL",
        "psql": "PostgreSQL",
        "nextjs": "Next.js",
        "next.js": "Next.js",
        "nodejs": "Node.js",
        "node.js": "Node.js",
        "reactjs": "React",
        "react.js": "React",
        "vuejs": "Vue",
        "vue.js": "Vue",
        "ts": "TypeScript",
        "js": "JavaScript",
        "py": "Python",
        "tf": "Terraform",
        "google cloud": "GCP",
        "ci/cd": "CI/CD",
        "cicd": "CI/CD",
    }

    _PRIMARY_LANGUAGES = [
        "Python", "Go", "Rust", "TypeScript", "JavaScript",
        "Java", "C++", "C#", "Ruby", "PHP", "Swift", "Kotlin", "Scala",
    ]

    _STACKOVERFLOW_TAG_MAP: Dict[str, str] = {
        "Go": "go",
        "Kubernetes": "kubernetes",
        "Python": "python",
        "FastAPI": "fastapi",
        "React": "reactjs",
        "Next.js": "next.js",
        "TypeScript": "typescript",
        "Rust": "rust",
        "PostgreSQL": "postgresql",
        "PyTorch": "pytorch",
        "TensorFlow": "tensorflow",
        "Docker": "docker",
        "Terraform": "terraform",
        "AWS": "amazon-web-services",
        "Kafka": "apache-kafka",
    }

    _SKILL_CATALOG: Tuple[str, ...] = (
        # Languages
        "Python", "JavaScript", "TypeScript", "Go", "Golang", "Rust", "Java", "C++", "C#",
        "Ruby", "PHP", "Swift", "Kotlin", "Scala", "SQL", "HTML", "CSS", "Bash", "Shell",
        # Frameworks & Libraries
        "React", "Next.js", "Vue", "Angular", "Node.js", "Express", "FastAPI", "Django",
        "Flask", "Spring Boot", "ASP.NET", "GraphQL", "Tailwind CSS", "Redux", "PyTorch",
        "TensorFlow", "Pandas", "NumPy", "Scikit-Learn", "LangChain", "LlamaIndex",
        # Cloud & DevOps
        "AWS", "GCP", "Google Cloud", "Azure", "Docker", "Kubernetes", "Terraform",
        "CI/CD", "GitHub Actions", "Jenkins", "GitLab CI", "Ansible", "Linux", "eBPF",
        # Databases & Queues
        "PostgreSQL", "Postgres", "MySQL", "MongoDB", "Redis", "Kafka", "Elasticsearch",
        "DynamoDB", "Cassandra", "Snowflake", "SQLite", "RabbitMQ",
        # Architecture & AI
        "Microservices", "Distributed Systems", "REST API", "gRPC", "System Design",
        "LLMs", "RAG", "Agentic AI", "Vector Databases", "ChromaDB", "Pinecone", "Milvus",
        "Prompt Engineering", "Agile", "Scrum", "TDD", "WebAssembly", "LLVM",
    )

    _SKILL_MATCHERS: Tuple[Tuple[re.Pattern[str], str], ...] = _compile_skill_matchers(
        _SKILL_CATALOG,
        _SKILL_SYNONYMS,
    )

    _SENIORITY_PATTERNS: Tuple[Tuple[re.Pattern[str], str, int], ...] = (
        (re.compile(r"\b(principal|staff|distinguished|architect|vp|director|head)\b"), "Principal/Staff", 8),
        (re.compile(r"\b(senior|sr\.?|lead|team lead)\b"), "Senior", 5),
        (re.compile(r"\b(junior|jr\.?|entry|intern|associate|graduate)\b"), "Junior", 1),
    )

    _WORK_MODE_PATTERNS: Tuple[Tuple[re.Pattern[str], str], ...] = (
        (re.compile(r"\b(remote|distributed|wfh|work from home|anywhere)\b"), "Remote"),
        (re.compile(r"\b(hybrid)\b"), "Hybrid"),
        (re.compile(r"\b(onsite|on-site|in-office|office)\b"), "Onsite"),
    )

    @classmethod
    def _extract_skills(cls, text: str, sections: Dict[str, str]) -> List[str]:
        """Extract multi-domain technical and functional skills from resume text using deterministic taxonomy."""
        found_skills = set()
        text_lower = (text or "").lower()
        skills_sec = sections.get("skills", "").lower()

        if skills_sec:
            for pattern, canonical in cls._SKILL_MATCHERS:
                if pattern.search(skills_sec) or pattern.search(text_lower):
                    found_skills.add(canonical)
        else:
            for pattern, canonical in cls._SKILL_MATCHERS:
                if pattern.search(text_lower):
                    found_skills.add(canonical)

        return sorted(found_skills)

    @classmethod
    def extract_deterministic_facets(cls, text: str) -> Dict[str, Any]:
        """
        Freehire-inspired deterministic facet extraction (<1ms, zero LLM latency).
        Normalizes skills, seniority, work_mode, primary GitHub language, and StackOverflow tags.
        """
        raw = (text or "").strip()
        lower = raw.lower()
        skills = cls._extract_skills(raw, {})

        # Seniority detection
        seniority = "Mid-Level"
        min_years = 3
        for pattern, label, years in cls._SENIORITY_PATTERNS:
            if pattern.search(lower):
                seniority = label
                min_years = years
                break

        # Work mode detection
        work_mode = "Remote"
        for pattern, mode in cls._WORK_MODE_PATTERNS:
            if pattern.search(lower):
                work_mode = mode
                break

        primary_language = None
        for lang in cls._PRIMARY_LANGUAGES:
            if lang in skills:
                primary_language = lang.lower()
                break

        so_tags = [
            cls._STACKOVERFLOW_TAG_MAP[s]
            for s in skills
            if s in cls._STACKOVERFLOW_TAG_MAP
        ]
        if not so_tags and primary_language:
            so_tags = [primary_language]

        return {
            "skills": skills,
            "seniority": seniority,
            "min_years": min_years,
            "work_mode": work_mode,
            "primary_language": primary_language,
            "stackoverflow_tags": so_tags[:3],
        }

    @classmethod
    def _extract_experience(cls, experience_text: str) -> List[Dict[str, Any]]:
        """Parse employment history blocks, companies, titles, and dates."""
        if not experience_text.strip():
            return []

        # Common job titles to look for
        title_keywords = [
            r"Engineer", r"Developer", r"Architect", r"Lead", r"Manager",
            r"Director", r"Head of", r"VP", r"Scientist", r"Analyst",
            r"Consultant", r"Specialist", r"Administrator", r"Designer"
        ]
        title_regex = rf"(?:Senior|Staff|Principal|Lead|Junior|Associate)?\s*(?:[A-Za-z\s]+)?(?:{'|'.join(title_keywords)})"

        # Date regex: e.g. 2021 - Present, Jan 2020 - Dec 2022, 05/2019 - 08/2021
        date_regex = r"((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December|\d{1,2}\/)?\s*\d{4}\s*[-–—to\s]+\s*(?:Present|Current|\d{4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{1,2}\/)\s*\d{4}))"

        experiences = []
        paragraphs = [p.strip() for p in experience_text.split("\n\n") if p.strip()]

        for p in paragraphs:
            date_match = re.search(date_regex, p, re.IGNORECASE)
            title_match = re.search(title_regex, p, re.IGNORECASE)
            
            if date_match or title_match:
                lines = [line.strip() for line in p.split("\n") if line.strip()]
                header_line = lines[0] if lines else ""
                
                # Derive company and title
                title = title_match.group(0).strip() if title_match else "Software Engineer"
                date_str = date_match.group(1).strip() if date_match else "2021 — PRESENT"
                
                # Clean company candidate from header
                company = header_line
                for remove_str in (title, date_str, "•", "|", "-"):
                    company = company.replace(remove_str, "")
                company = company.strip(" ,-|•") or "Technology Enterprise"
                
                bullets = [line.lstrip("•-* ").strip() for line in lines[1:] if len(line.strip()) > 10]
                desc = "\n".join(bullets) if bullets else (lines[1] if len(lines) > 1 else header_line)

                experiences.append({
                    "title": title,
                    "company": company,
                    "period": date_str,
                    "desc": desc,
                    "bullets": bullets
                })

        return experiences[:6]  # Cap at top 6 positions

    @classmethod
    def _extract_education(cls, education_text: str) -> List[Dict[str, Any]]:
        """Parse academic degrees, universities, and graduation years."""
        if not education_text.strip():
            return []

        degree_regex = r"(?:Bachelor|Master|Doctor|Ph\.?D\.?|B\.?S\.?|B\.?A\.?|M\.?S\.?|M\.?A\.?|B\.?Tech|M\.?Tech|Associate)\s*(?:of\s+[A-Za-z\s]+|in\s+[A-Za-z\s]+)?"
        year_regex = r"\b(19\d{2}|20\d{2})\b"

        education_items = []
        # Group by paragraphs or double newlines first, fallback to line pairs
        blocks = [b.strip() for b in education_text.split("\n\n") if b.strip()]
        if len(blocks) == 1 and len(blocks[0].split("\n")) > 1:
            # If all in one block, process combined text
            blocks = [blocks[0]]

        for block in blocks:
            lines = [line.strip() for line in block.split("\n") if line.strip()]
            full_block_text = " ".join(lines)
            
            degree_match = re.search(degree_regex, full_block_text, re.IGNORECASE)
            year_match = re.search(year_regex, full_block_text)
            
            # Find institution (Stanford University, MIT, etc.)
            inst_match = re.search(r"([A-Za-z\s]+(?:University|College|Institute|School|Academy)[A-Za-z\s]*)", full_block_text, re.IGNORECASE)
            
            if degree_match or inst_match:
                degree = degree_match.group(0).strip() if degree_match else "Bachelor of Science"
                year = year_match.group(1) if year_match else "2020"
                institution = inst_match.group(1).strip() if inst_match else (lines[1] if len(lines) > 1 else lines[0])
                
                # Cleanup institution text
                for rm in (degree, year, "•", "|", "-"):
                    institution = institution.replace(rm, "")
                institution = institution.strip(" ,-|•") or "University"

                education_items.append({
                    "degree": degree,
                    "institution": institution,
                    "year": year
                })

        return education_items[:4]

    @classmethod
    def _extract_initial_summary(cls, text: str) -> str:
        """Extract opening summary paragraph if explicitly defined."""
        lines = [line.strip() for line in text[:1500].split("\n") if line.strip()]
        # Skip header lines with names or contact info
        for line in lines[2:]:
            if len(line) > 80 and not re.search(r"@|linkedin|github|\+?\d{3}", line, re.IGNORECASE):
                return line
        return ""

    @classmethod
    def _estimate_experience_years(cls, experiences: List[Dict[str, Any]], raw_text: str) -> int:
        """Calculate approximate years of professional experience."""
        # Check for explicit statements like "7+ years of experience"
        match = re.search(r"(\d+)\+?\s*years?\s+(?:of\s+)?experience", raw_text, re.IGNORECASE)
        if match:
            try:
                return min(35, max(1, int(match.group(1))))
            except Exception:  # noqa: S110
                pass

        # Calculate based on identified positions
        if experiences:
            years = len(experiences) * 2  # Average 2 years per listed position
            return min(30, max(1, years))

        return 3
