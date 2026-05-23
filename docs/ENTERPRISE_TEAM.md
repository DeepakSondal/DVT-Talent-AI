# Enterprise Team & BYOK Architecture

## 1. The Disconnected Swarm Trap: Solved
By transitioning DVT Talent AI to an **Enterprise Team / BYOK (Bring Your Own Key)** model, you have successfully offloaded all API burn (OpenAI, Serper) to the end-users. 

However, to prevent the "Disconnected Swarm" issue (where recruiters inside the same agency do not share the same memory or billing), we have introduced the **Manager Oversight Architecture**.

## 2. Database Schema Upgrades (`models.py`)
I have successfully implemented the following highly-relational schema changes:
*   **User Role Upgrade:** Added `UserRole.MANAGER` to the enum.
*   **The Team Model:** Created a dedicated `Team` table featuring `default_credit_limit` and `shared_pool_enabled` to allow managers to control how much AI compute their recruiters can burn.
*   **The Vault (TeamApiKeys):** Created a secure `TeamApiKeys` table linked exclusively to the Manager's `team_id`.
*   **Relational Tracking:** Injected `recruiter_id` into the `Candidate`, `Lead`, and `EmailSent` tables. This allows the database to aggregate exactly which recruiter sourced which candidate, preventing team overlap.

## 3. Manager API Endpoints (`team.py`)
I created a dedicated, role-secured router exclusively for Managers:
*   `POST /api/v1/team/invite`: Invites a recruiter and natively assigns them the Manager's `team_id`.
*   `GET /api/v1/team/members`: Lists all recruiters under the Manager's domain.
*   `GET /api/v1/team/analytics`: Aggregates the total number of sourced candidates across the entire team to calculate ROI.
*   `PATCH /api/v1/team/members/{user_id}/quota`: Enforces a hard limit on monthly API credits per recruiter.
*   `GET /api/v1/team/candidates`: A global view for the Manager to see every candidate sourced by their team.

## 4. Modified Agent Logic (`pydantic_config.py`)
The `get_pydantic_model()` config has been refactored to accept a `dynamic_api_key` string.
*   **Inheritance:** When a Recruiter clicks "Initiate Swarm", the Orchestrator will query the `TeamApiKeys` table using the Recruiter's `team_id`. It extracts the Manager's OpenAI key and passes it as `dynamic_api_key` to Pydantic AI. The agent runs locally, but bills the Manager's account.

## 5. Security & Testing
*   **Audit Logging:** Because `recruiter_id` is now attached to all core tables, your `AuditLogMiddleware` natively captures who performed what action.
*   **Automated Tests:** I wrote a Pytest suite (`test_team.py`) that successfully verifies a Manager can be created, a Recruiter can be invited, and the Recruiter correctly inherits the Manager's API Keys.

## 6. Frontend Roadmap (Next Steps)
To complete this integration on the UI side, you must update the Next.js application:
1.  **Sidebar Update:** Show a "Team Management" tab *only* if `user.role === 'manager'`.
2.  **API Vault UI:** Build a settings page where the Manager pastes their OpenAI and Serper keys, executing a `POST` to the `TeamApiKeys` table.
3.  **Candidate Roster:** Update the candidates table to show an avatar of the Recruiter who sourced them.

---
**Verification Report:** The backend architecture is fully staged. Run `alembic revision --autogenerate -m "enterprise_teams"` and `alembic upgrade head` in your local terminal to finalize the database migration.
