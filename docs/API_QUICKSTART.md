# DVT Talent AI — API Quickstart Guide
**Version:** 2.0.0 (October 2026)  

Integrate the dual-sided AI recruitment platform into your custom workflows.

---

## 🔑 1. Authentication

### Recruiter Login
```bash
curl -X POST http://127.0.0.1:8000/api/v1/auth/login \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "username=recruiter@agency.com&password=your_secure_password"
```

### Candidate Registration
```bash
curl -X POST http://127.0.0.1:8000/api/v1/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "email": "engineer@talent.io",
       "password": "SecurePassword123!",
       "full_name": "Alex Chen",
       "role": "candidate"
     }'
```

---

## 🎯 2. Candidate Portal API (Career-Ops)

### Fetch Candidate Profile & Privacy Settings
```bash
curl -X GET http://127.0.0.1:8000/api/v1/candidate-portal/profile \
     -H "Authorization: Bearer <CANDIDATE_TOKEN>"
```

### Update Privacy Shield (Domain Blacklist)
```bash
curl -X PUT http://127.0.0.1:8000/api/v1/candidate-portal/profile \
     -H "Authorization: Bearer <CANDIDATE_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "Senior AI Systems Engineer",
       "is_searchable": true,
       "hide_from_companies": ["currentemployer.com", "competitor.io"]
     }'
```

### Browse Verified Jobs with 5-Dimension Match Scores
```bash
curl -X GET http://127.0.0.1:8000/api/v1/candidate-portal/jobs \
     -H "Authorization: Bearer <CANDIDATE_TOKEN>"
```

### Generate STAR Behavioral Interview Flashcards
```bash
curl -X GET http://127.0.0.1:8000/api/v1/candidate-portal/interview-prep/<JOB_ID> \
     -H "Authorization: Bearer <CANDIDATE_TOKEN>"
```

---

## 💼 3. Recruiter API & Swarm Operations

### Trigger Autonomous Talent Sourcing Swarm
```bash
curl -X POST http://127.0.0.1:8000/api/v1/agents/swarm/trigger \
     -H "Authorization: Bearer <RECRUITER_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{
       "job_id": "<JOB_ID>",
       "seniority": "Senior",
       "target_sources": ["github", "linkedin"]
     }'
```

### Inspect Copilot Checkpoint
```bash
curl -X GET http://127.0.0.1:8000/api/v1/copilot/tasks/<TASK_ID>/checkpoint \
     -H "Authorization: Bearer <RECRUITER_TOKEN>"
```

### Approve Candidate Curation Checkpoint
```bash
curl -X POST http://127.0.0.1:8000/api/v1/copilot/tasks/<TASK_ID>/approve-sourcing \
     -H "Authorization: Bearer <RECRUITER_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{
       "approved_candidate_ids": ["<CANDIDATE_UUID_1>", "<CANDIDATE_UUID_2>"]
     }'
```

---

## 📡 4. Real-Time Telemetry (WebSocket)

Connect to the live agent stream to receive real-time updates and checkpoint alerts:
```javascript
const socket = new WebSocket("ws://127.0.0.1:8000/api/v1/ws/live?token=" + token);

socket.onmessage = (event) => {
  const signal = JSON.parse(event.data);
  console.log("Agent Telemetry:", signal.agent, signal.message);
};
```
