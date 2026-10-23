"""
DVT Talent AI — Multi-Format Resume Parser & Document Service
Extracts full text and structured career data from PDF, DOCX, and TXT resumes.
"""

import io
import os
import re
import uuid
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
import structlog

logger = structlog.get_logger(__name__)

def get_upload_dir() -> Path:
    try:
        from config import settings
        base = Path(getattr(settings, "upload_dir", Path(__file__).resolve().parent.parent / "uploads"))
    except Exception:
        base = Path(__file__).resolve().parent.parent / "uploads"
    return base / "resumes"


UPLOAD_DIR = get_upload_dir()


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
            except Exception:
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
        
        # Sanitize extension and base name
        ext = ("." + filename.rsplit(".", 1)[-1].lower()) if "." in filename else ".pdf"
        sanitized_name = re.sub(r"[^a-zA-Z0-9_\.-]", "_", filename)
        safe_filename = f"{candidate_id}_{resume_id}_{sanitized_name}"
        
        target_path = upload_path / safe_filename
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

    @classmethod
    def extract_text(cls, content_bytes: bytes, filename: str) -> str:
        """
        Extract complete text from PDF, DOCX, or TXT file bytes.
        """
        ext = ("." + filename.rsplit(".", 1)[-1].lower()) if "." in filename else ""
        text = ""

        # 1. PDF Extraction
        if ext == ".pdf":
            text = cls._extract_from_pdf(content_bytes)
            
        # 2. Word (DOCX / DOC) Extraction
        elif ext in {".docx", ".doc"}:
            text = cls._extract_from_docx(content_bytes)
            
        # 3. Plain Text / Fallback
        if not text.strip():
            text = cls._extract_from_plain_text(content_bytes)

        # Normalize line endings and whitespace
        clean_text = cls._clean_text(text)
        return clean_text

    @classmethod
    def _extract_from_pdf(cls, content_bytes: bytes) -> str:
        """Extract text from PDF using pypdf."""
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(content_bytes))
            pages_text = []
            for i, page in enumerate(reader.pages):
                page_content = page.extract_text() or ""
                if page_content.strip():
                    pages_text.append(page_content)
            
            extracted = "\n\n".join(pages_text)
            if extracted.strip():
                logger.info("pdf_text_extracted", pages=len(reader.pages), chars=len(extracted))
                return extracted
        except Exception as e:
            logger.warning("pypdf_extraction_failed", error=str(e))
        return ""

    @classmethod
    def _extract_from_docx(cls, content_bytes: bytes) -> str:
        """Extract text from Word .docx file using python-docx."""
        try:
            import docx
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
            except Exception:
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

    @classmethod
    def _extract_skills(cls, text: str, sections: Dict[str, str]) -> List[str]:
        """Extract multi-domain technical and functional skills from resume text."""
        skill_catalog = [
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
            "Prompt Engineering", "Agile", "Scrum", "TDD"
        ]

        found_skills = set()
        text_lower = text.lower()

        # Check in skills section first with high weight
        skills_sec = sections.get("skills", "").lower()

        for skill in skill_catalog:
            pattern = rf"\b{re.escape(skill.lower())}\b"
            if re.search(pattern, skills_sec) or re.search(pattern, text_lower):
                found_skills.add(skill)

        # Standardize synonyms
        if "Golang" in found_skills:
            found_skills.remove("Golang")
            found_skills.add("Go")
        if "Postgres" in found_skills:
            found_skills.remove("Postgres")
            found_skills.add("PostgreSQL")

        return sorted(list(found_skills))

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
                lines = [l.strip() for l in p.split("\n") if l.strip()]
                header_line = lines[0] if lines else ""
                
                # Derive company and title
                title = title_match.group(0).strip() if title_match else "Software Engineer"
                date_str = date_match.group(1).strip() if date_match else "2021 — PRESENT"
                
                # Clean company candidate from header
                company = header_line
                for remove_str in (title, date_str, "•", "|", "-"):
                    company = company.replace(remove_str, "")
                company = company.strip(" ,-|•") or "Technology Enterprise"
                
                bullets = [l.lstrip("•-* ").strip() for l in lines[1:] if len(l.strip()) > 10]
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
            lines = [l.strip() for l in block.split("\n") if l.strip()]
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
        lines = [l.strip() for l in text[:1500].split("\n") if l.strip()]
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
            except Exception:
                pass

        # Calculate based on identified positions
        if experiences:
            years = len(experiences) * 2  # Average 2 years per listed position
            return min(30, max(1, years))

        return 3
