# CampusConnect

Centralized campus placement management with enrollment-gated onboarding, document verification, and an AI-powered ATS resume analyzer (final-year B.Tech project).

## What is implemented

| Area | Implemented | 
| ----- | ----- | 
| **Accounts, Auth & Security** | Enrollment-gated student registration (`@iem.edu.in` / `@uem.edu.in`), session sign-in/out (`CC_SESSION`), Google & Microsoft OAuth2 SSO (restricted to registered college emails or linked personal Gmails), `STUDENT` / `DEPARTMENT_SPOC` / `PLACEMENT_ADMIN` RBAC, account lockout, CSRF protection | 
| **Student Registry & Bulk CSV** | Admin Student Registry CSV import (`Name, Enrollment No, Registration No, Degree, Stream, Graduation Year`), bulk student account CSV import, and bulk company CSV import | 
| **Extended Student Profile & Docs** | 5-tab student profile (`Basic Info`, `IDs & Docs`, `10th & 12th` dynamic marks, `Semesters & CGPA` with `(CGPA − 0.75) × 10` percentage, `Parents & Address`), completeness tracker, and file uploads (Aadhaar ID, College ID, 10th/12th marksheets, semester transcript, PDF resume) | 
| **SPOC & Admin Verification** | Department-scoped SPOC and cross-department Admin student verification (`Enrollment / Branch`), in-browser document inspection modal, and **Verify & Lock / Unlock** controls with audit notes | 
| **Companies & Placement Drives** | Company CRUD with logo URLs & domain favicon fallbacks; drive lifecycle (`DRAFT`, `OPEN`, `CLOSED`, `CANCELLED`) with batch, branch, min CGPA, max backlogs, CTC, location, and deadline criteria | 
| **Eligibility, Applications & Rounds** | Server-side `EligibilityEvaluator`, one-click apply/withdraw, duplicate & deadline guards, recruitment round progression (`APPLIED` → `SHORTLISTED` → `SELECTED` / `REJECTED` / `WITHDRAWN`), offer issuance, and status history | 
| **Notifications** | Persistent in-app notifications and asynchronous email alerts (`Spring Mail`) for eligible drives and application updates | 
| **AI Resume Analyzer** | Gemini AI (`gemini-3.5-flash-lite`) + automatic local semantic/synonym fallback; live drive JD loader, section scores (`Skills`, `Projects`, `Impact`, `Clarity`), actionable bullet rewrites, `jsPDF` report export, and PostgreSQL scan history (`V14`) | 
| **Frontend** | Role-aware navigation (`Layout.jsx`), light/dark theme tokens, Admin, SPOC, Student, Drives, Applications, and AI Resume Analyzer pages | 

## Planned (Phase 3)

* **Analytics Dashboard**: Interactive placement rate, CTC distribution, and department-wise charts (`recharts`) with NAAC/NBA exports.

* **Placement Policy Enforcement**: Automated offer caps, Dream/Super-Dream CTC upgrade multipliers, and eligibility blocks for placed students.

* **CampusGuide AI**: Personalized AI placement buddy per student using verified profile, resume, and target drive context.

* **Production Infrastructure**: Cloud object storage (`S3`/`GCS` via `StorageService`), Redis session store, and CI/CD container deployment.

## Security design

* **Session & OAuth2**: HttpOnly `CC_SESSION` cookie (`SameSite=Lax`; set `SESSION_COOKIE_SECURE=true` over HTTPS) and CSRF token enforcement (`GET /api/v1/auth/csrf`).

* **Enrollment-Gated Onboarding**: Registration requires an unclaimed record in `student_registry` and an `@iem.edu.in` or `@uem.edu.in` email. OAuth2 sign-in never auto-creates accounts; it only signs in existing users via their college email or linked personal Gmail.

* **Server-Side Authorization**: `@PreAuthorize` role guards, ownership checks on student resources, and department scoping for SPOCs.

## Database migrations (Flyway `V1`–`V14`)

Managed forward-only under `backend/src/main/resources/db/migration/` (`ddl-auto: validate`):

* `V1`–`V4`: Baseline schema, users, student profiles, companies.

* `V5`–`V12`: Case-insensitive company index, placement drives, applications, status history, recruitment rounds, offers, notifications, company `logo_url`.

* `V13`: `student_registry`, extended `student_profiles` columns, and `student_documents`.

* `V14`: `resume_analyses` scan history table.

## Required software

* Java 17+ (21 recommended), Maven 3.9+

* Node.js 18+ (20+ recommended)

* PostgreSQL 14+ (18 in use)

## Windows setup (PowerShell)

```
# 1) Database (once, in psql as a superuser)
#    CREATE USER campusconnect WITH PASSWORD 'choose-a-local-password';
#    CREATE DATABASE campusconnect OWNER campusconnect;

# 2) Configuration
Copy-Item .env.example .env
# Edit DB_URL, DB_USER, DB_PASSWORD, BOOTSTRAP_ADMIN_*, and optionally GEMINI_API_KEY / GEMINI_MODEL=gemini-3.5-flash-lite

# 3) Backend (terminal 1). Flyway applies V1..V14 on startup.
cd backend
mvn clean spring-boot:run

# 4) Frontend (terminal 2)
cd frontend
npm.cmd ci
npm.cmd run dev                  # http://localhost:5173


```

## Tests

```
cd backend;  mvn test
cd frontend; npm.cmd test
cd frontend; npm.cmd run build


```

## Layout

```
backend/        Spring Boot API (auth/, account/, student/, company/, drive/, application/, department/, notification/, storage/, config/, db/migration/)
frontend/       React + Vite SPA (api/, auth/, components/, pages/, lib/)
reference/demo/ Original single-file HTML demo


```

## Usage & Attribution Notice

This repository is published for **educational, portfolio, and reference purposes** as part of a final-year B.Tech capstone project.

* **Cloning & Learning**: You are welcome to clone, fork, and study the architecture, Spring Boot APIs, Flyway migrations, and React UI for personal learning or inspiration.
* **Attribution Required**: If you reuse parts of this codebase or build upon it, please include clear credit to the original authors and link back to this repository.
* **Academic Integrity**: Do **not** submit this project (in whole or part) as your own original coursework, thesis, or capstone project.
* **No Bundled Credentials**: Configure your own PostgreSQL database, OAuth2 client credentials, SMTP settings, and `GEMINI_API_KEY` in a local `.env` file before running.
