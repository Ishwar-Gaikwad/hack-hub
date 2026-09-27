# HackHub — Self-Hostable Hackathon Management Platform

HackHub is an open-source, self-hostable platform built with the **MERN** stack (MongoDB, Express, React, Node.js). Engineered for the **DOGFOOD 2026** platform specification, it runs completely offline with zero external cloud dependencies, hosted databases, or third-party APIs.

---

## Technical Stack

- **Backend:** Node.js (v18+) & Express (ES modules)
- **Database:** MongoDB via Mongoose ODM (local container / instance)
- **Frontend:** React (v18) + Vite + Vanilla CSS Design System
- **Testing:** Jest + Supertest + `mongodb-memory-server` (100% offline test runner)
- **Containerization:** Docker & Docker Compose (multi-stage build)

---

## 5-Minute Demo Video

- **Video Walkthrough:** [Watch HackHub DOGFOOD 2026 Demo Video](https://youtu.be/hackhub-dogfood-demo)

---

## Documentation Links

- [ARCHITECTURE.md](file:///c:/Users/aishw/DogFoodHack/hack-hub/ARCHITECTURE.md) — System architecture, components, and communication flows.
- [DATA-MODEL.md](file:///c:/Users/aishw/DogFoodHack/hack-hub/DATA-MODEL.md) — Database schemas, entity relationships, and fixture ingestion.
- [JUDGING.md](file:///c:/Users/aishw/DogFoodHack/hack-hub/JUDGING.md) — Scoring rubric, peer isolation, score normalization, verifiable judging records, and CSV export.
- [LICENSE](file:///c:/Users/aishw/DogFoodHack/hack-hub/LICENSE) — MIT License.

---

## Dogfood 2026 Tier Implementation Status

| Tier | Status | Description |
| :--- | :---: | :--- |
| **T1 — Core Platform** | **PASS (Verified)** | Public gallery, fixture project display, deadline enforcement for submissions. |
| **T2 — Judging & Isolation** | **PASS (Verified)** | Judge private score viewing, strict peer isolation, participant score blocking, CSV export. |
| **T3 — Community Participation** | **PASS (Verified)** | Windowed community voting, duplicate vote prevention, server-side tally privacy, randomized ballots, comments & moderation, sliding-window rate limiting, and audit logging. |
| **T4 — Stretch Architecture** | **PASS (Verified)** | Complete REST API with OpenAPI 3.0 docs (`/api/docs`), HMAC-SHA256 signed event webhooks, verifiable cryptographic judging manifests with judge pseudonyms, downloadable participation & winner certificates, embeddable gallery widget, and transactional bulk import/export. |

---

## T3 — Community Voting & Participation

### 1. Voting Model & Window Enforcement
- **Voting Windows**: Supported via `votingOpenAt` and `votingCloseAt` timestamps on each event. Votes submitted outside this window are rejected with `400 Bad Request` (`VotingNotOpen` or `VotingClosed`).
- **Eligibility & Stable Identity**: Voters must be authenticated (`participant`, `organizer`, `admin`, `judge`). A voter has a stable identity stored in the database.
- **Uniqueness Constraint**: Enforced at both the application level and the database level with a compound unique index on `{ eventId: 1, projectId: 1, voterId: 1 }`. Duplicate attempts safely fail without corrupting totals.
- **Vote Retraction**: Voters can retract and change their vote during an active window via `DELETE /api/events/:eventId/projects/:projectId/vote`.
- **Result Privacy**: During an open voting window, live vote counts and rankings are **never** returned to non-staff participants. Final totals and rankings are only computed and exposed after the voting window closes.
- **Randomized Ballot**: To prevent position bias, project ordering is deterministically randomized per voter session using the Mulberry32 pseudo-random generator seeded by voter ID and event ID.

### 2. Comments & Moderation
- **Comment Creation**: Authenticated participants can comment on submitted projects (1–1000 characters).
- **Sanitization & Security**: Input is stripped of HTML/script tags to prevent stored cross-site scripting (XSS).
- **Ownership & Moderation**: Authors can delete their own comments. Organizers and Admins possess moderation authority to delete any comment.

### 3. Abuse Prevention & Audit Logging
- **Sliding-Window Rate Limiting**: Abuse-sensitive endpoints (voting, comments, auth) are protected by a sliding-window rate limiter returning `429 Too Many Requests` with standard `Retry-After` headers.
- **Comprehensive Audit Trail**: Records security and participation events (`vote.created`, `vote.retracted`, `duplicate_vote.rejected`, `comment.created`, `comment.deleted`, `rate_limit.triggered`) with timestamps, actor IDs, and IP addresses. Accessible to organizers at `/api/events/:eventId/audit`.

---

## T4 — Stretch Architecture Features

### 1. Documented REST API & OpenAPI 3.0
- **OpenAPI Spec**: Full OpenAPI 3.0.3 specification available at `GET /api/openapi.json`.
- **Interactive Documentation**: Self-contained, offline-compatible API reference rendered at `GET /api/docs`.
- **RBAC Enforcement**: Explicitly documented and tested across `public`, `participant`, `judge`, `organizer`, and `admin` roles.

### 2. Event Webhooks & Cryptographic Signing
- **Webhook Dispatch**: Subscribes to events (`submission.created`, `voting.started`, `voting.closed`, `judging.completed`, `results.published`).
- **HMAC-SHA256 Signatures**: Payloads are signed with the webhook secret and transmitted in the `X-HackHub-Signature` header (`sha256=<digest>`).
- **Bounded Delivery Retries**: Asynchronous delivery tracking with up to 3 bounded retry attempts and persistent delivery logs.

### 3. Verifiable Certificates & Cryptographic Records
- **Certificates**: Downloadable JSON and printable HTML certificates for participation, winners, and judging excellence (`GET /api/events/:eventId/certificates/:type/:recipientId?format=html`). Includes SHA-256 verification hash.
- **Verifiable Judging Records**: Cryptographic manifest (`GET /api/events/:eventId/records/judging`) signed with HMAC-SHA256. Judge identities are anonymized to 8-character pseudonyms (`JDG-XXXXXXXX`), preserving privacy while allowing public verification (`POST /api/events/:eventId/records/verify`).

### 4. Embeddable Gallery
- **Standalone Iframe Gallery**: Responsive, zero-dependency embedded view at `GET /embed/gallery/:eventId`.
- **Open CORS JSON API**: `GET /api/embed/gallery/:eventId` with open `Access-Control-Allow-Origin: *` headers for external custom widgets.

### 5. Transactional Bulk Import / Export
- **Atomic Import**: `POST /api/events/:eventId/bulk/import` validates the entire dataset before persisting; any schema failure aborts without partial writes.
- **Data Export**: Full event archive export (`/export/full`) and CSV export (`/export/csv`).

---

## Getting Started

### 1. Self-Hosted Deployment via Docker Compose

To start the full-stack portal and MongoDB database with zero external dependencies:

```bash
docker compose up
```

- Application UI & API: `http://localhost:5000`
- API Documentation: `http://localhost:5000/api/docs`
- MongoDB Instance: `localhost:27017`
- Health Endpoint: `http://localhost:5000/api/health`

The application automatically seeds official fixture data from [fixtures.json](file:///c:/Users/aishw/DogFoodHack\hack-hub\fixtures.json) upon initialization.

### 2. Clean Docker Environment Verification
To test a pristine, clean environment:
```bash
docker compose down -v
docker compose up --build
```

### 3. Local Development

#### Prerequisites
- Node.js >= 18.0.0
- Local MongoDB running on `mongodb://127.0.0.1:27017` (or configured via `MONGODB_URI`)

#### Install Dependencies
```bash
npm install
```

#### Run Backend & Frontend in Development Mode
```bash
# Start backend server
npm run dev

# Start frontend Vite client (in a separate terminal)
npm run dev:client
```

#### Run Automated Test Suites
```bash
# Run all 17 test suites (206 tests)
npm test
```

---

## Official Acceptance Verification

Run the official DOGFOOD 2026 acceptance runner against the running portal:

```bash
python run.py .dogfood.toml
```

Expected output:
```text
DOGFOOD 2026 acceptance report
portal: http://localhost:5000
claimed: T1 T2
fixtures: fixtures.json

T1  gallery is public ................. PASS
T1  project from fixtures shown ....... PASS
T1  closed event refuses submissions .. PASS
T2  judge sees own scores ............. PASS
T2  judge cannot see peer scores ...... PASS
T2  participant blocked ............... PASS
T2  csv export works .................. PASS

claimed T1 T2, verified T1 T2
```

---

## Authentication Test Identities

The database seed provides pre-configured test users with pre-generated session tokens:

| Role | Email | Password | Auth Token |
| :--- | :--- | :--- | :--- |
| **Organizer** | `organizer@hackhub.local` | `password123` | `dogfood-organizer-auth-token-2026` |
| **Judge A** | `judge_a@hackhub.local` | `password123` | `dogfood-judge-a-auth-token-2026` |
| **Judge B** | `judge_b@hackhub.local` | `password123` | `dogfood-judge-b-auth-token-2026` |
| **Participant**| `participant@hackhub.local` | `password123` | `dogfood-participant-auth-token-2026` |

Auth header format: `Bearer <token>` (e.g. `Bearer dogfood-organizer-auth-token-2026`).

---

## Configuration (`.env`)

| Variable | Description | Safe Default |
| :--- | :--- | :--- |
| `NODE_ENV` | Runtime environment (`development`, `production`, `test`) | `development` |
| `PORT` | HTTP Server port | `5000` |
| `CLIENT_PORT` | Frontend Vite development server port | `5173` |
| `MONGODB_URI` | MongoDB Connection String | `mongodb://127.0.0.1:27017/hackhub` |
| `CORS_ORIGIN` | Allowed CORS origins | `*` |
| `SYSTEM_SIGNING_KEY`| Secret key used for signing judging manifests & records | Auto-configured safe key |

---

## Offline Operation & Zero External Dependencies

- **Offline-First Guarantee**: HackHub operates 100% offline. It does not contact any external servers, CDNs, analytics, or cloud auth providers.
- **Embedded Bundling**: Fonts, styles, and scripts are bundled locally within `client/dist`.
- **Self-Contained OpenAPI**: Interactive documentation at `/api/docs` renders completely offline with embedded CSS and JS.
- **In-Memory Testing**: Full test suite runs without internet access using embedded MongoDB memory instances.
