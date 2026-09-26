# HackHub — Self-Hostable Hackathon Management Platform

HackHub is an open-source, self-hostable platform built with the **MERN** stack (MongoDB, Express, React, Node.js). It is designed to run completely offline with zero external cloud dependencies or hosted databases.

---

## Technical Stack

- **Backend:** Node.js (v18+) & Express
- **Database:** MongoDB via Mongoose ORM/ODM
- **Frontend:** React (v18) + Vite + Vanilla CSS Design System
- **Testing:** Jest + Supertest + MongoMemoryServer (100% offline test runner)
- **Containerization:** Docker & Docker Compose (multi-stage build)

---

## Getting Started

### 1. Self-Hosted Deployment via Docker Compose

To run the entire full-stack application and local MongoDB database with zero internet dependencies:

```bash
docker compose up
```

- Application UI & API: `http://localhost:5000`
- MongoDB Instance: `localhost:27017`
- Health Endpoint: `http://localhost:5000/api/health`

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

## Configuration (`.env`)

| Variable | Description | Safe Default |
| :--- | :--- | :--- |
| `NODE_ENV` | Runtime environment (`development`, `production`, `test`) | `development` |
| `PORT` | HTTP Server port | `5000` |
| `CLIENT_PORT` | Frontend Vite development server port | `5173` |
| `MONGODB_URI` | MongoDB Connection String | `mongodb://127.0.0.1:27017/hackhub` |
| `CORS_ORIGIN` | Allowed CORS origins | `*` |

---

## Health Check API

### `GET /health` or `GET /api/health`

Verifies server uptime and active database round-trip connectivity.

**Response `200 OK` (Healthy):**
```json
{
  "status": "healthy",
  "timestamp": "2026-09-26T18:22:49.079Z",
  "uptime": 18,
  "environment": "development",
  "database": {
    "status": "connected",
    "connected": true,
    "name": "hackhub",
    "host": "127.0.0.1"
  }
}
```

**Response `503 Service Unavailable` (Unhealthy/Disconnected):**
```json
{
  "status": "unhealthy",
  "timestamp": "2026-09-26T18:22:49.079Z",
  "uptime": 18,
  "environment": "development",
  "database": {
    "status": "disconnected",
    "connected": false
  }
}
```
