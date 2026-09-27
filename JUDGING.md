# HackHub — Judging & Evaluation Specification

This document details the judging architecture, assignment workflows, evaluation rubric, scoring isolation, and ranking mechanisms in **HackHub**.

---

## 1. Judging Workflow Overview

```mermaid
stateDiagram-v2
    [*] --> SubmissionsClosed: Event Deadline Passed
    SubmissionsClosed --> JudgeAssignment: Organizer Assigns Judges
    JudgeAssignment --> ScoringPhase: Judges Review Assigned Projects
    ScoringPhase --> IsolatedReview: Judge Scores Projects (Private)
    IsolatedReview --> Aggregation: System Aggregates & Normalizes Scores
    Aggregation --> ResultsPublished: Organizer Exports CSV & Declares Winners
    ResultsPublished --> [*]
```

---

## 2. Evaluation Rubric & Criteria

Judges evaluate submitted projects across five standardized dimensions on a 1–10 scale:

| Criterion | Weight | Description |
| :--- | :---: | :--- |
| **Technical Innovation & Architecture** | 25% | Novelty of the approach, sound architectural patterns, code quality, and self-hosted reliability. |
| **Execution & Completeness** | 25% | Functionality, adherence to project goals, stability, and lack of critical bugs. |
| **Design, Usability & Polish** | 20% | Visual appeal, responsive interface, clarity of user flows, and accessibility. |
| **Impact & Practicality** | 20% | Real-world problem-solving value, offline utility, and deployment feasibility. |
| **Documentation & Demonstration** | 10% | Clear README, architecture diagrams, data models, and video demonstration. |

---

## 3. Judge Assignment & Security Isolation

- **Role Authorization**: Only users with the `judge` role (e.g., `judge_a`, `judge_b`) can access scoring dashboards and submit evaluation scores.
- **Strict Peer Isolation**:
  - A judge can only query and view their own evaluations (`GET /api/judge/scores`).
  - Attempting to inspect another judge's score sheet (`GET /api/judge/scores?judge=judge_a` from `judge_b`) is blocked server-side by backend authorization middleware, returning **HTTP 401 or 403 Forbidden**.
  - Participants attempting to view judge scores are strictly blocked (**HTTP 401 or 403 Forbidden**).

---

## 4. Score Normalization & Aggregation

To eliminate scoring biases across lenient vs. strict judges, HackHub supports standard score normalization:
1. **Z-Score Normalization**:
   $$Z = \frac{X - \mu}{\sigma}$$
   Transforms raw scores $X$ into standard deviation units using each judge's mean $\mu$ and standard deviation $\sigma$.
2. **Min-Max Scaling**:
   $$Score_{norm} = \frac{Z - Z_{min}}{Z_{max} - Z_{min}} \times 100$$
   Normalizes scores to a consistent 0–100 scale.
3. **Trimmed Mean Ranking**:
   Drops the highest and lowest outlying score for projects with 3 or more judge reviews to prevent score manipulation.

---

## 5. CSV Export & Results Delivery

Organizers can export full scoring sheets and leaderboard rankings via:
```http
GET /api/export.csv
Authorization: Bearer <organizer_token>
```
The endpoint returns:
- Standard `text/csv` format.
- Columns: `Project ID, Project Title, Team Name, Track, Raw Average, Normalized Score, Final Rank`.
