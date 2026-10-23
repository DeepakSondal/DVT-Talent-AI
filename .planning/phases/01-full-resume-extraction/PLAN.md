# Phase Plan: Full Resume Ingestion, Multi-Format Extraction & Document Management

**Phase:** Full Resume Ingestion & Multi-Format Parsing  
**Target:** Enable complete document extraction from PDF (`.pdf`), Word (`.docx`), and text formats, persist original files, extract comprehensive career histories (work experience, education, skills, contact info), and provide UI download/viewing capabilities for both recruiters and candidates.

---

## 1. Context & Problem Statement

### Current Limitations Identified
1. **Binary Decoding Defect**:
   - `backend/api/routes/candidate_portal.py` (line 428) and `backend/workers/tasks.py` (line 163) invoke `content_bytes.decode("utf-8", errors="ignore")`.
   - For PDF files, this produces unreadable binary stream fragments.
   - For Word files (`.docx`), which are zipped XML archives, this produces raw zip header bytes (`PK\x03\x04...`).
2. **Shallow Skill Matching**:
   - Extraction currently uses a naive substring check against a static list of 27 hardcoded skills (`known_skills = ["python", "react", ...]`).
   - Work experience, employment history, company names, job titles, education, degrees, certifications, and summaries are completely lost.
3. **No File Persistence or Retrieval**:
   - Uploaded PDF and DOCX files are discarded from memory after the request finishes.
   - There is no persistent file storage or endpoint for recruiters or candidates to view or download the original resume.
4. **Mocked Recruiter Intake**:
   - In `frontend/src/app/dashboard/candidates/page.tsx`, `handleFileUpload` is a client-side mock that synthesizes fake candidate data instead of sending the file to the backend API.

---

## 2. Target Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Upload File (PDF / DOCX)                        │
│             (Recruiter Dashboard or Candidate Career Portal)           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 FastAPI Multipart Intake & Validation                  │
│       - Size check (≤10MB)                                             │
│       - MIME/Extension validation (.pdf, .docx, .doc, .txt)            │
│       - Secure file persistence: `backend/uploads/resumes/{uuid}.*`    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               Multi-Format Text Extraction Engine                      │
│   `backend/services/resume_parser.py`                                  │
│   ├── PDF Stream Parser (`pypdf.PdfReader`)                            │
│   ├── Word Document Parser (`docx.Document`)                           │
│   └── Plain Text / UTF-8 fallback with encoding detection              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│              Structured AI / Regex Career Extraction                   │
│   - Contact Info: Full Name, Email, Phone, Location, Links             │
│   - Work Experience: Company, Job Title, Dates, Bullets/Highlights     │
│   - Education: Institution, Degree, Field of Study, Year               │
│   - Skills: Technical, Domain, Tools, Methodologies                    │
│   - Professional Executive Summary                                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       Persistence & Vector Layer                       │
│   - `resumes`: file_path, raw_text (full), parsed_data (structured)    │
│   - `candidates`: auto-populate profile fields & skill vectors         │
│   - Download Endpoint: `GET /candidates/{id}/resume/download`          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Work Breakdown & Task Execution Plan

### Task 1: Parser Dependency & Document Engine (`backend/services/resume_parser.py`)
- **Dependencies**: Add `pypdf>=5.0.0` to `backend/requirements.txt` (verified installed in `venv`).
- **Core Engine**: Implement `ResumeParserService`:
  - `extract_text_from_pdf(content_bytes: bytes) -> str`: Multi-page text extraction handling layouts, form fields, and clean whitespace normalization.
  - `extract_text_from_docx(content_bytes: bytes) -> str`: Paragraph and table text extraction from `.docx`.
  - `extract_structured_resume(raw_text: str) -> StructuredResume`:
    - Regex & heuristic parsers for contact details (phones, emails, GitHub, LinkedIn, portfolios).
    - Section segmenter identifying: `Summary`, `Experience`, `Education`, `Skills`, `Certifications`.
    - Work experience itemizer: company name, job title, date range, bullet points.
    - Education itemizer: school, degree, graduation year.
    - Comprehensive skill extractor with multi-word tech stack tagging.

### Task 2: File Storage & Download Endpoints
- **Storage Subsystem**:
  - Configure upload directory `backend/uploads/resumes/` (with `.gitignore` to avoid committing uploaded resumes).
  - Save file with safe UUID filename: `{candidate_id}_{resume_id}{extension}`.
  - Store relative `file_url` or path in `resumes.file_url`.
- **API Endpoints**:
  - `GET /api/v1/candidates/{id}/resume/download`: Allows authenticated recruiters to download the candidate's original resume file with correct `Content-Disposition` and `Content-Type`.
  - `GET /api/v1/candidate-portal/resume/download`: Allows authenticated candidates to download their own uploaded resume.
  - `GET /api/v1/candidates/{id}/resume/text`: Returns the full extracted raw text and structured sections for preview.

### Task 3: Backend Ingestion Route Updates
- **Update `backend/api/routes/candidate_portal.py`**:
  - Replace `content_bytes.decode("utf-8")` with `ResumeParserService`.
  - Save original file to upload directory.
  - Populate `cand.skills`, `cand.experience_years`, `cand.current_company`, and `new_resume.raw_text` with full clean text.
  - Store full structured JSON in `new_resume.parsed_data`.
- **Update `backend/api/routes/candidates.py`**:
  - Add `POST /api/v1/candidates/upload`: Allows recruiters to directly upload a resume file and auto-create a Candidate entity populated with the parsed name, email, phone, location, skills, and work history.

### Task 4: Frontend UI Enhancements (Recruiter & Candidate)
- **Recruiter Candidates List (`frontend/src/app/dashboard/candidates/page.tsx`)**:
  - Replace `handleFileUpload` mock with real `candidatesApi.uploadResume` / intake endpoint.
  - Show upload progress, success toast with parsed candidate name, and refresh candidate table.
- **Candidate Detail Page (`frontend/src/app/dashboard/candidates/[id]/page.tsx`)**:
  - Add **"Download Original Resume"** button (with PDF/Word icon) linking to `/api/v1/candidates/{id}/resume/download`.
  - Add **"Full Resume"** tab/viewer rendering:
    - Structured work experience timeline (companies, roles, dates, responsibilities).
    - Education background.
    - Toggle to view raw extracted text in a clean monospace viewer.
- **Candidate Portal Profile (`frontend/src/app/portal/profile/page.tsx`)**:
  - Display parsed career summary, work history, and download button for the candidate's active document.

### Task 5: Automated Testing & Verification
- Add unit tests in `backend/tests/test_resume_parser.py`:
  - Test PDF parsing with synthetic PDF buffer.
  - Test DOCX parsing with synthetic DOCX buffer.
  - Test structured extraction (contact info, skills, experience).
- Add integration tests in `backend/tests/test_resume_upload_api.py`:
  - Upload PDF resume to Candidate Portal.
  - Verify `raw_text` contains full document text.
  - Verify download endpoint returns exact original binary bytes.

---

## 4. Verification Gates & Acceptance Criteria

1. **Format Compatibility**:
   - Validated against both `.pdf` (PDF 1.4 - 1.7) and `.docx` (Office OpenXML).
   - Zero binary corruption or decoding crashes.
2. **Data Completeness**:
   - `Resume.raw_text` contains 100% of readable resume content (not truncated to 25 skills).
   - `Resume.parsed_data` includes structured `experience` and `education` objects.
3. **Document Retrieval**:
   - `GET .../resume/download` delivers original document with proper filename headers.
4. **UI Fidelity**:
   - Recruiters can view full career history and download the original file in both Light and Dark themes.
