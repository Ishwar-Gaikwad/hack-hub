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
- [JUDGING.md](file:///c:/Users/aishw/DogFoodHack/hack-hub/JUDGING.md) — Scoring rubric, peer isolation, score normalization, and CSV export.
- [LICENSE](file:///c:/Users/aishw/DogFoodHack/hack-hub/LICENSE) — MIT License.

---

## Getting Started

### 1. Self-Hosted Deployment via Docker Compose

To start the full-stack portal and MongoDB database with zero external dependencies:

```bash
docker compose up
```

- Application UI & API: `http://localhost:5000`
- MongoDB Instance: `localhost:27017`
- Health Endpoint: `http://localhost:5000/api/health`

The application automatically seeds official fixture data from [fixtures.json](file:///c:/Users/aishw/DogFoodHack/hack-hub/fixtures.json) upon initialization.

### 2. Local Development

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

#### Build Frontend Assets
```bash
npm run build
```

#### Run Automated Tests
```bash
npm test
```

---

## Official Acceptance Verification

Run the official DOGFOOD 2026 acceptance runner against the running portal:

```bash
python run.py .dogfood.toml > acceptance-report.txt
```

Verified results are recorded in [acceptance-report.txt](file:///c:/Users/aishw/DogFoodHack/hack-hub/acceptance-report.txt).

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

---

## Known Limitations

- **Email Delivery**: Because HackHub is designed for 100% offline self-hosting with zero external dependencies, email delivery for team invitations uses in-app tokens and shareable invite codes rather than external SMTP/Sendgrid APIs.
- **File Upload Storage**: Project repository links are stored as URLs; blob asset storage operates locally within the container volume.
