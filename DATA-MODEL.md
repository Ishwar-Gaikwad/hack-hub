# HackHub — Data Model & Schema Specification

This document details the database architecture, entity schemas, relationships, fixture loading mechanisms, and data ingestion/export pipelines in **HackHub**.

---

## 1. Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    USER ||--o{ SESSION : "maintains"
    USER ||--o{ EVENT : "organizes"
    USER ||--o{ TEAM : "creates"
    USER ||--o{ TEAM_MEMBER : "participates in"
    
    EVENT ||--o{ TRACK : "categorizes into"
    EVENT ||--o{ PRIZE : "offers"
    EVENT ||--o{ TEAM : "hosts"
    EVENT ||--o{ PROJECT : "receives"
    
    TEAM ||--|{ TEAM_MEMBER : "consists of"
    TEAM ||--o{ INVITATION : "issues"
    TEAM ||--o| PROJECT : "submits"
    
    TRACK ||--o{ PROJECT : "classifies"

    USER {
        ObjectId _id PK
        string email UK
        string passwordHash
        string role "admin | organizer | judge | participant"
        date createdAt
    }

    SESSION {
        ObjectId _id PK
        ObjectId userId FK
        string token UK
        date expiresAt "TTL index"
        boolean isValid
    }

    EVENT {
        ObjectId _id PK
        string name
        string description
        date startDate
        date submissionDeadline
        date endDate
        string status "draft | published | ended | closed"
        ObjectId createdBy FK
    }

    TRACK {
        ObjectId _id PK
        ObjectId eventId FK
        string name
        string description
    }

    PRIZE {
        ObjectId _id PK
        ObjectId eventId FK
        string name
        string value
        string description
    }

    TEAM {
        ObjectId _id PK
        ObjectId eventId FK
        string name
        ObjectId creatorId FK
        array members
    }

    PROJECT {
        ObjectId _id PK
        ObjectId eventId FK
        ObjectId teamId FK
        ObjectId trackId FK
        string title
        string description
        string repositoryUrl
        string status "draft | submitted"
        date createdAt
    }
```

---

## 2. Core Entities & Schema Details

### 2.1 User (`User`)
- **Collection**: `users`
- **Fields**:
  - `email`: (String, unique, lowercase, required)
  - `password`: (String, bcrypt-hashed, min length 6)
  - `role`: (Enum: `admin`, `organizer`, `judge`, `participant`, default: `participant`)
  - `createdAt`, `updatedAt`: (Timestamps)

### 2.2 Session (`Session`)
- **Collection**: `sessions`
- **Fields**:
  - `userId`: (ObjectId ref `User`, required, indexed)
  - `token`: (String, unique, 64-char hex or deterministic test key)
  - `expiresAt`: (Date, indexed with MongoDB automatic TTL `expireAfterSeconds: 0`)
  - `isValid`: (Boolean, indexed)

### 2.3 Event (`Event`)
- **Collection**: `events`
- **Fields**:
  - `name`: (String, required, min 3 chars)
  - `description`: (String, optional)
  - `startDate`: (Date, required)
  - `submissionDeadline`: (Date, required — verified `startDate < submissionDeadline <= endDate`)
  - `endDate`: (Date, required)
  - `votingOpenAt`: (Date, optional voting window start)
  - `votingCloseAt`: (Date, optional voting window end)
  - `status`: (Enum: `draft`, `published`, `ended`, `closed`)
  - `createdBy`: (ObjectId ref `User`)

### 2.4 Track & Prize (`Track`, `Prize`)
- **Collection**: `tracks`, `prizes`
- Track associates a submission category with an Event.
- Prize associates an award title, dollar/token value, and description with an Event.

### 2.5 Team & Invitation (`Team`, `Invitation`)
- **Collection**: `teams`, `invitations`
- A Team belongs to an Event and is created by a Participant.
- `members` contains an array of `{ userId, role: 'owner' | 'member', joinedAt }`.
- Invitations generate tokenized join requests.

### 2.6 Project (`Project`)
- **Collection**: `projects`
- **Fields**:
  - `eventId`: (ObjectId ref `Event`, required)
  - `teamId`: (ObjectId ref `Team`, required, one project per team per event)
  - `trackId`: (ObjectId ref `Track`, required)
  - `title`: (String, required, min 2 chars)
  - `description`: (String)
  - `repositoryUrl`: (String)
  - `status`: (Enum: `draft`, `submitted`)
  - `createdAt`, `updatedAt`: (Timestamps)

### 2.7 Score (`Score` - T2 & T4)
- **Collection**: `scores`
- **Fields**:
  - `judgeId`: (ObjectId ref `User`, required, indexed)
  - `judgeRef`: (String, indexed)
  - `eventId`: (ObjectId ref `Event`, indexed)
  - `projectId`: (ObjectId ref `Project`, indexed)
  - `projectRef`: (String, indexed)
  - `criteria`: `{ functionality: Number(1..5), quality: Number(1..5), innovation: Number(1..5) }`
  - `rawTotal`: (Number, unweighted total)
  - `normalizedScore`: (Number, scaled 0..100)
  - `comment`: (String)
- **Indexes**: Compound index `{ judgeId: 1, projectId: 1 }`.

### 2.8 Community Vote (`Vote` - T3)
- **Collection**: `votes`
- **Fields**:
  - `eventId`: (ObjectId ref `Event`, required, indexed)
  - `projectId`: (ObjectId ref `Project`, required, indexed)
  - `voterId`: (ObjectId ref `User`, required, indexed)
  - `createdAt`: (Date, default `Date.now`)
- **Constraints**: Compound unique index `{ eventId: 1, projectId: 1, voterId: 1 }` strictly preventing duplicate voting attempts at database level.

### 2.9 Project Comment (`Comment` - T3)
- **Collection**: `comments`
- **Fields**:
  - `eventId`: (ObjectId ref `Event`, required, indexed)
  - `projectId`: (ObjectId ref `Project`, required, indexed)
  - `authorId`: (ObjectId ref `User`, required, indexed)
  - `content`: (String, required, length 1..1000 characters, HTML sanitized against XSS)
  - `createdAt`, `updatedAt`: (Timestamps)

### 2.10 Audit Log (`AuditLog` - T3)
- **Collection**: `audit_logs`
- **Fields**:
  - `eventId`: (ObjectId ref `Event`, indexed)
  - `actorId`: (ObjectId ref `User`, optional)
  - `action`: (String, required: `vote.created`, `vote.retracted`, `duplicate_vote.rejected`, `comment.created`, `comment.deleted`, `rate_limit.triggered`)
  - `targetType`: (String: `vote`, `comment`, `project`, `auth`)
  - `targetId`: (String)
  - `details`: (Mixed JSON Object)
  - `ipAddress`: (String)
  - `timestamp`: (Date, indexed)

### 2.11 Event Webhook (`Webhook` - T4)
- **Collection**: `webhooks`
- **Fields**:
  - `eventId`: (ObjectId ref `Event`, required, indexed)
  - `targetUrl`: (String, required, valid HTTP/HTTPS URL)
  - `secret`: (String, required, used for HMAC-SHA256 signature computation)
  - `subscribedEvents`: (Array of Strings: `submission.created`, `voting.started`, etc.)
  - `active`: (Boolean, default `true`)
  - `deliveryLogs`: (Array of `{ deliveryId, event, statusCode, success, error, attemptCount, timestamp }`)
  - `createdAt`, `updatedAt`: (Timestamps)

---

## 3. Fixture Data Loading (`fixtures.json`)

The platform loads official benchmark data from `fixtures.json` located at the repository root:
1. `seedDatabase()` parses `fixtures.json` during build, test, or initial server startup.
2. The fixture event is seeded with `submissions_close = "2026-03-01T18:00:00Z"`. Since this timestamp is in the past, the event is initialized in a `closed` state to test deadline rejection.
3. Test identities (`organizer`, `judge_a`, `judge_b`, `participant`) are created with persistent sessions and published auth tokens.
4. Benchmark projects (`HackHub Autonomous Workflow Orchestrator`, `Visionary Defect Inspector`) are seeded with `submitted` status to populate the public gallery.

---

## 4. Ingestion & Export Lifecycles

- **Ingestion**:
  - Direct REST JSON endpoints for event creation, team formation, project drafting, and submission.
  - Transactional bulk import (`POST /api/events/:eventId/bulk/import`) with atomic all-or-nothing validation preventing partial corrupt writes.
- **Export**:
  - Public Project Gallery: `GET /projects` and `GET /api/projects` (unauthenticated, filtered for submitted projects only).
  - Organizer CSV Export (T2): `GET /api/export.csv` generating comma-separated reports of teams, projects, scores, and rankings.
  - Full Event Archive (T4): `GET /api/events/:eventId/bulk/export/full` providing complete JSON data dumps for archival or migrations.
  - Public Verifiable Judging Records (T4): `GET /api/events/:eventId/records/judging` delivering cryptographically signed manifests.
