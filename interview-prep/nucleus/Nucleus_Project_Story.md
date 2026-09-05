# Nucleus — Order Intake & Report Delivery Service

*Interview narrative for a Senior/Staff Full-Stack Engineer (~12 yrs exp)*

> How to use this: read it as your own story, not a script. The numbers and choices below are internally consistent, so you can defend any one of them without contradicting another. Speak in "we decided / I owned" terms — you led the design, not just coded it.

---

## 1. The one-line pitch

> "Nucleus is the microservice I built from scratch that sits at the front and the back of our genetic-testing pipeline. It's the system of record for an order — from the moment a clinician (or a partner lab like Quest Diagnostics) submits a test request, through sequencing and bioinformatics, all the way to a geneticist-signed report that the patient securely downloads. It handles both single orders from our web portal and batch feeds of 5,000+ orders a day from partner labs."

That framing matters: **Nucleus is not the sequencing pipeline and not the bioinformatics pipeline.** Those are heavy, batch, compute-bound systems owned by other teams. Nucleus is the *orchestration and lifecycle* service around them — lightweight, always-on, transactional. That distinction is the seed of your "why a microservice" answer.

---

## 2. Business context (so the architecture makes sense)

The domain (based on a clinical genomics lab like Blueprint Genetics):

1. A clinician orders a genetic test and a **sample is collected** from the patient (buccal swab or blood).
2. The sample goes through a **DNA sequencing pipeline** (wet lab + NGS instruments producing raw reads).
3. Reads run through a **bioinformatics pipeline** (alignment, variant calling, annotation) that produces a draft clinical report.
4. A **geneticist reviews** the draft, classifies variants, signs off, and the final PDF report is **uploaded to S3**.
5. The ordering clinician / patient can **download the report only if authenticated via AWS Cognito**.

Nucleus is the connective tissue across all five steps. Every other system talks to it to answer one question: *"What is the state of order X, and what should happen next?"*

---

## 3. Why I built it as a microservice (this is the question they'll dig into)

Lead with business/operational reasons, then technical ones. Weak answers say "microservices are modern." Strong answers say "these two workloads have fundamentally different shapes."

**a) Radically different scaling and lifecycle profiles.**
The sequencing and bioinformatics pipelines are batch, GPU/CPU-heavy, and run for hours per sample. Order management is thousands of small, fast, transactional requests plus long-lived state that lives for weeks. You can't scale a variant-calling cluster and a REST order API on the same knobs. Splitting Nucleus out let me scale it horizontally on cheap stateless containers while the pipelines scaled independently on their own compute.

**b) Independent deployability and blast radius.**
Order intake is customer-facing and revenue-critical — a clinician failing to place an order is a lost patient and lost revenue. I did not want a bioinformatics deploy to ever risk taking down order intake. Separate service = separate deploy cadence, separate on-call, separate failure domain.

**c) A clean PHI / compliance boundary.**
Nucleus is the service that touches patient identity + order + report metadata. Keeping it as a bounded context let me put the strictest HIPAA/GDPR controls, audit logging, and encryption exactly where the PHI lives, instead of smearing compliance concerns across every system.

**d) A stable contract for many consumers.**
The portal, partner batch feeds (Quest), the LIMS, the bioinformatics pipeline, and the geneticist review tool all needed *one* authoritative place to read/write order state. A dedicated service with a versioned REST + event contract beat five systems reaching into a shared database.

> Honesty tip for the interview: if pushed on "would you do microservices again?", say yes *for this boundary* but that you deliberately did **not** shatter it into ten tiny services — Nucleus is a right-sized service, not nanoservices. Senior signal = knowing when *not* to split.

---

## 4. Architecture

### 4.1 High-level flow (describe this out loud)

```
                        ┌────────────────────────┐
   Clinician / Patient  │   Ordering Web Portal   │  (React SPA)
        browser  ──────▶│      (frontend)         │
                        └───────────┬────────────┘
                                    │ HTTPS (JWT from Cognito)
                                    ▼
                        ┌────────────────────────┐
   Quest Diagnostics    │      API Gateway        │
   batch file (SFTP/S3) │   + AWS Cognito authz    │
        │               └───────────┬────────────┘
        │ nightly/hourly            │ REST
        ▼                           ▼
 ┌──────────────┐         ┌───────────────────────────┐
 │ Batch Ingest │────────▶│         NUCLEUS            │
 │   Worker     │  SQS    │  (Node.js / NestJS API)   │
 └──────────────┘         │  - Order lifecycle FSM     │
                          │  - Idempotent intake       │
                          │  - Report access control   │
                          └───┬───────────┬──────┬─────┘
                              │           │      │
                    ┌─────────┘           │      └──────────┐
                    ▼                     ▼                 ▼
              ┌───────────┐        ┌────────────┐    ┌────────────┐
              │  RDS      │        │  Redis      │    │ SQS / SNS  │
              │  MySQL    │        │  (cache +   │    │ (events to │
              │ (system   │        │  idempotency│    │  pipelines)│
              │ of record)│        │   keys)     │    └─────┬──────┘
              └───────────┘        └────────────┘          │
                                                            ▼
   ┌───────────────┐   status callbacks   ┌────────────────────────────┐
   │  LIMS /        │◀────────────────────▶│  Sequencing pipeline        │
   │  Sequencing    │                       │  Bioinformatics pipeline    │
   └───────────────┘                       │  Geneticist review tool     │
                                            └──────────────┬─────────────┘
                                                           │ final signed PDF
                                                           ▼
                                                    ┌────────────┐
                                                    │  S3 bucket │  (reports,
                                                    │ (encrypted)│   SSE-KMS)
                                                    └─────┬──────┘
                                                          │ presigned URL
                                     patient download ◀───┘ (issued by Nucleus)
```

### 4.2 What Nucleus actually owns

The **order lifecycle finite state machine (FSM)** is the heart of the service. An order moves through explicit states, and Nucleus is the only system allowed to transition them:

```
CREATED → SAMPLE_COLLECTED → RECEIVED_IN_LAB → SEQUENCING →
BIOINFORMATICS → PENDING_GENETICIST_REVIEW → REPORT_SIGNED →
REPORT_AVAILABLE → CLOSED
              │
              └──▶ ON_HOLD / CANCELLED / SAMPLE_FAILED (recollect)
```

Every transition is (a) validated against allowed edges, (b) written to an append-only `order_status_history` table, and (c) emitted as a domain event (`order.status.changed`) onto SNS/SQS so downstream systems react without polling.

### 4.3 Two intake paths, one core

- **Single order (portal):** `POST /api/v1/orders` — synchronous, validated, returns `201` with the order ID.
- **Batch order (Quest Diagnostics, 5,000+/day):** partner drops a file (CSV/HL7-ish) into an SFTP endpoint backed by S3. An S3 event triggers a **Batch Ingest Worker** that parses, validates row-by-row, and calls Nucleus' internal bulk-intake API. Each row is processed **idempotently** (partner order number = idempotency key) so a re-dropped or partially-failed file never creates duplicates. Bad rows go to a dead-letter store with a per-file reconciliation report back to the partner.

That batch path *is* your original resume bullet — but now it's framed as one intake adapter feeding a service you own end-to-end.

---

## 5. Tech stack (and why each choice)

Pitch this as "boring, deliberate technology for a compliance-critical system," not a zoo of trendy tools.

| Layer | Choice | Why (say this) |
|---|---|---|
| Language/runtime | **Node.js + TypeScript** | Team fluency, huge I/O concurrency for an I/O-bound order API, TS for safety on a PHI schema. |
| Framework | **NestJS** (Express under the hood) | Opinionated modules, DI, and guards/interceptors that map cleanly to auth + audit cross-cutting concerns. |
| Datastore | **MySQL on Amazon RDS** (Multi-AZ) | Orders are relational and transactional; ACID matters for money + PHI. Multi-AZ for HA. |
| Migrations | **Flyway** | Versioned, repeatable, auditable schema changes — non-negotiable in a regulated environment. |
| Cache / idempotency | **Redis (ElastiCache)** | Idempotency keys, hot-order caching, rate limiting, short-lived presigned-URL throttle. |
| Async messaging | **Amazon SQS + SNS** | Decouple Nucleus from slow pipelines; retries + DLQ for reliability. (Kafka if you want to claim higher scale — see note.) |
| AuthN/AuthZ | **AWS Cognito** (OIDC/JWT) | Federated clinician + patient identity; report download gated on a valid Cognito token. |
| Object storage | **Amazon S3** (SSE-KMS) | Signed clinical PDFs; Nucleus issues short-lived presigned URLs, never proxies the file. |
| API edge | **API Gateway + ALB** | TLS termination, throttling, WAF, JWT authorizer in front of the service. |
| Containers | **Docker on ECS Fargate** (or EKS) | Stateless service, easy horizontal scale, no server management. |
| IaC | **Terraform** | Reproducible infra, peer-reviewed, environment parity. |
| CI/CD | **GitHub Actions / Jenkins** | Lint → test → Flyway dry-run → build image → deploy to staging → prod with approval. |
| Observability | **CloudWatch + OpenTelemetry + Sentry** | Structured logs (PHI-scrubbed), traces across the SQS hops, alerting on stuck orders. |

> **Scale-up option if the interviewer wants "big":** say you started on SQS/SNS and moved the high-volume partner-event stream to **Kafka (MSK)** when a second and third partner lab came on board and you needed ordered, replayable event streams per partner. This is a very credible senior evolution story.

---

## 6. How other services call Nucleus

Be precise about *who calls what* — it proves you owned the contract.

**Inbound (others → Nucleus):**
- **Web portal → Nucleus (sync REST):** create order, look up status, request report download. JWT from Cognito, validated at the gateway and re-checked in a NestJS guard.
- **Batch Ingest Worker → Nucleus (internal REST, bulk):** `POST /internal/v1/orders:batch`, mutually authenticated (mTLS / IAM SigV4), idempotent per row.
- **LIMS / Sequencing → Nucleus (webhook/callback):** `PATCH /api/v1/orders/{id}/status` as the sample physically moves (received, sequencing started/failed). Signed with an HMAC shared secret.
- **Bioinformatics pipeline → Nucleus (event):** publishes `report.draft.ready`; Nucleus advances the FSM and notifies the geneticist queue.
- **Geneticist review tool → Nucleus:** on sign-off, uploads final PDF to S3 and calls `POST /api/v1/orders/{id}/report` with the S3 object key + checksum; Nucleus flips the order to `REPORT_AVAILABLE`.

**Outbound (Nucleus → others):**
- Emits domain events (`order.created`, `order.status.changed`, `report.available`) on SNS → SQS fan-out to the pipelines, a notification service (email/SMS "your results are ready"), and an analytics sink.
- Calls Cognito admin APIs to link a patient account to their order on first login.
- Generates **S3 presigned GET URLs** (60–300 s TTL) so the browser downloads the PDF directly from S3 — Nucleus authorizes, S3 serves. Nucleus never streams PHI through itself.

**Contract discipline (senior signal):** REST is versioned (`/v1`), documented with **OpenAPI**, events have a **schema registry / versioned JSON schema**, and every breaking change ships behind a new version with a deprecation window.

---

## 7. Database design

MySQL, normalized, PHI-aware. Give the shape, a few key columns, and the *reasoning* (indexes, history, soft deletes, encryption).

### 7.1 Core tables

**`clients`** — ordering institutions / partner labs (Quest, hospitals).
`id (PK)`, `name`, `type (HOSPITAL|PARTNER_LAB|CLINIC)`, `billing_ref`, `created_at`.

**`providers`** — the ordering clinician.
`id (PK)`, `client_id (FK)`, `full_name`, `npi`, `email`, `cognito_sub (nullable)`.

**`patients`** — PHI, encrypted at column level.
`id (PK)`, `mrn_enc`, `first_name_enc`, `last_name_enc`, `dob_enc`, `sex`, `cognito_sub (nullable, unique)`, `created_at`. *(`_enc` columns are app-layer encrypted via KMS data keys; the DB never sees plaintext PHI.)*

**`orders`** — the aggregate root / system of record.
`id (PK)`, `order_number (unique)`, `partner_order_number (nullable, unique per client)`, `client_id (FK)`, `provider_id (FK)`, `patient_id (FK)`, `test_panel_code`, `status (enum)`, `priority (ROUTINE|EXPRESS)`, `batch_id (FK nullable)`, `created_at`, `updated_at`, `version (optimistic lock)`.
*Indexes:* `(status)`, `(client_id, partner_order_number)` unique for idempotency, `(created_at)` for reporting.

**`order_items`** — a single order can request multiple panels/tests.
`id (PK)`, `order_id (FK)`, `test_code`, `specimen_type (BUCCAL|BLOOD)`, `status`.

**`samples`** — physical specimen tracking.
`id (PK)`, `order_id (FK)`, `barcode (unique)`, `collected_at`, `received_at`, `qc_status`, `sequencing_run_id (nullable)`.

**`order_status_history`** — append-only audit of every transition.
`id (PK)`, `order_id (FK)`, `from_status`, `to_status`, `changed_by (system|user id)`, `reason`, `created_at`. *Never updated or deleted.*

**`reports`** — one signed report per completed order (or versions).
`id (PK)`, `order_id (FK)`, `s3_bucket`, `s3_key`, `checksum_sha256`, `signed_by (geneticist id)`, `signed_at`, `version`, `status (SIGNED|SUPERSEDED)`.

**`batch_jobs`** — one row per ingested partner file.
`id (PK)`, `client_id (FK)`, `source_file_key`, `total_rows`, `succeeded`, `failed`, `status (PROCESSING|COMPLETED|PARTIAL|FAILED)`, `started_at`, `finished_at`.

**`batch_job_errors`** — dead-lettered rows for reconciliation.
`id (PK)`, `batch_job_id (FK)`, `row_number`, `raw_payload`, `error_code`, `error_detail`.

**`audit_log`** — every read/write of PHI (who, what, when, source IP) for HIPAA.
`id`, `actor`, `action`, `entity_type`, `entity_id`, `ip`, `created_at`.

### 7.2 Design decisions to defend

- **Why relational / MySQL over NoSQL?** Orders are highly relational (client → provider → patient → order → items → samples → report) and demand transactional integrity across those writes. A batch row must create patient + order + items **atomically or not at all**. That's a textbook ACID transaction, not an eventual-consistency use case.
- **Append-only history + audit_log:** regulators ask "who changed this order and when" — you answer with immutable tables, not mutable status columns.
- **Idempotency at the schema level:** the `(client_id, partner_order_number)` unique constraint is your last line of defense against duplicate orders even if the app-layer key check fails.
- **Optimistic locking (`version`):** two callbacks (LIMS + bioinformatics) can hit the same order concurrently; the version column prevents lost updates.
- **PHI column encryption + KMS:** plaintext identity never lands in MySQL; the DB stores ciphertext, keys live in KMS, and access is logged.
- **Soft deletes / retention:** orders aren't hard-deleted; a retention job purges per the data-retention policy after the legal window.

### 7.3 Flyway story

Every schema change is a versioned migration (`V1__init.sql`, `V2__add_batch_jobs.sql`, …) checked into the repo and applied by CI **before** the app rolls out. Rules you enforced: migrations are **forward-only and additive** in production (add column nullable → backfill → make non-null in a later migration), never a destructive change coupled to a deploy, and every migration is peer-reviewed. This is exactly the kind of discipline they want to hear for a regulated system.

---

## 8. Cloud deployment

- **Compute:** Nucleus runs as a Docker container on **ECS Fargate**, min 3 tasks across 3 AZs, autoscaled on CPU + SQS queue depth + request latency. Stateless, so scale-out is trivial — the whole reason it's a separate service.
- **Data:** **RDS MySQL Multi-AZ** with automated backups, PITR, and a read replica for reporting/analytics queries so heavy reads never touch the transactional primary.
- **Cache/queues:** **ElastiCache Redis** (idempotency + hot cache); **SQS** with a **dead-letter queue** for every consumer; **SNS** for fan-out.
- **Storage:** **S3** with SSE-KMS, bucket policy denying any non-TLS access, versioning on, and lifecycle rules moving old reports to Glacier per retention policy.
- **Identity:** **Cognito** user pools (separate pools for clinicians vs patients), JWT authorizer at API Gateway.
- **Networking/security:** service in **private subnets**, no public IPs; API Gateway + ALB + **WAF** in front; **VPC endpoints** for S3/SQS so traffic never leaves the AWS network; secrets in **Secrets Manager**; least-privilege **IAM roles per task**.
- **IaC + pipeline:** everything in **Terraform**; CI/CD runs lint → unit/integration tests (Testcontainers-backed MySQL) → **Flyway migrate on staging** → image build → **blue/green** deploy via CodeDeploy with automatic rollback on health-check failure.
- **DR/HA:** Multi-AZ everywhere; documented RTO/RPO; backups tested by periodic restore drills.
- **Observability/SLOs:** dashboards for order intake rate, FSM stuck-state alarms (e.g., "orders in SEQUENCING > 72h"), DLQ depth alerts, p99 latency SLO on the intake API.

---

## 9. Numbers you can quote (and defend)

Keep them consistent with each other:

- **~5,000+ orders/day** from the Quest batch feed + a few hundred/day from the portal → call it **~5,500 orders/day peak**, spiky (batch drops overnight).
- Batch file processing: **5,000 rows in under ~10 minutes**, processed concurrently with backpressure (bounded worker pool), idempotent.
- Intake API **p99 latency < 200 ms**; **99.9% availability** target on the customer-facing path.
- **~3 Fargate tasks** baseline, autoscaling to ~10 during the nightly batch window.
- Report download authorized in **< 100 ms** (Cognito verify + presigned URL), file served directly by S3.

If asked "how big was the team / your role": you **designed and built Nucleus from scratch**, owned the schema, the FSM, the batch pipeline, the AWS infra (Terraform), and the on-call runbook; you worked with the LIMS, bioinformatics, and frontend teams to define the contracts.

---

## 10. Likely follow-up interview questions (with model answers)

**1. How do you guarantee you never create a duplicate order when Quest re-sends a file?**
Three layers: (a) each partner row carries a stable `partner_order_number` used as an idempotency key checked in Redis; (b) the bulk intake endpoint is idempotent — re-submitting the same key returns the existing order, not a new one; (c) a DB unique constraint on `(client_id, partner_order_number)` as the final guard. So even a full file replay is a no-op.

**2. A batch of 5,000 has 30 bad rows. What happens?**
Row-level processing, not file-level all-or-nothing. Good rows commit; the 30 failures land in `batch_job_errors` with error codes, the `batch_jobs` row is marked `PARTIAL`, and we send the partner a reconciliation report so they can fix and re-drop only the bad rows (which are idempotent, so no dupes).

**3. Why MySQL and not DynamoDB / MongoDB?**
The data is deeply relational and needs multi-row ACID transactions (patient + order + items + sample created atomically). Strong consistency and referential integrity are requirements, not nice-to-haves, in a clinical/billing context. NoSQL would push that integrity into application code and make audit queries harder. I'd reach for NoSQL for the high-volume *event*/telemetry stream, not the system of record.

**4. How is patient data (PHI) protected?**
Encryption in transit (TLS everywhere, TLS-only S3 bucket policy) and at rest (RDS + S3 SSE-KMS). Sensitive identity columns are additionally **app-layer encrypted** with KMS data keys, so plaintext PHI never hits the DB. Access is least-privilege IAM per task, every PHI access is written to `audit_log`, and logs are PHI-scrubbed. This maps to HIPAA/GDPR controls.

**5. How does report download actually work securely?**
The browser asks Nucleus for a report. Nucleus verifies the Cognito JWT, checks that the authenticated subject is the ordering provider or the linked patient for that specific order, then issues a **short-lived (≤5 min) S3 presigned GET URL**. The file streams from S3 directly — Nucleus authorizes but never proxies PHI bytes, which keeps it stateless and cheap to scale.

**6. Two systems update the same order at the same time — how do you avoid lost updates?**
Optimistic concurrency: each order carries a `version` column; updates are conditional on the version and bump it. A conflicting write fails and retries against fresh state. Combined with the explicit FSM, illegal or racing transitions are rejected rather than silently overwriting each other.

**7. Why microservice and not a module in a monolith?**
Different scaling shape (transactional always-on vs batch compute-heavy), independent deployability so a pipeline deploy can't break revenue-critical order intake, and a clean PHI/compliance boundary. I right-sized it though — one cohesive service around the order bounded context, not a swarm of nanoservices.

**8. What if the bioinformatics pipeline is down for hours?**
Nucleus is decoupled via SQS. Order intake keeps working; events queue up and are retried with backoff. Poison messages go to a DLQ with alerting. Orders simply stay in their current FSM state; nothing is lost. When the pipeline recovers, it drains the queue. I also alarm on "orders stuck in state > threshold" so ops notices even if a consumer silently stalls.

**9. How do you do zero-downtime schema changes with Flyway on a live 5k/day system?**
Expand-then-contract: add columns nullable, deploy code that writes both old and new, backfill in the background, switch reads, then a later migration drops the old column. Migrations are forward-only and additive in prod, run in CI before the app rolls, and never bundle a destructive change with a feature deploy. Blue/green deploy means the old version keeps serving until the new one is healthy.

**10. How would you scale Nucleus to 50,000 orders/day and 5 partner labs?**
The API is stateless, so scale Fargate tasks and add RDS read replicas / consider Aurora. The bigger change is the event backbone: move from SQS/SNS to **Kafka (MSK)** for per-partner ordered, replayable streams and higher throughput. Partition batch ingestion per partner so one lab's huge file can't starve another's. Cache hot lookups in Redis. The relational core stays; I'd shard by client only if a single-writer primary genuinely became the bottleneck — and I'd prove that with metrics first.

**11. What was the hardest bug / trade-off?**
Good place for a real-sounding story: e.g., a partner occasionally sent the *same* file twice within seconds, and the naive Redis idempotency check had a race under concurrency — two workers both missed the key and both inserted. The DB unique constraint caught it (one insert failed), but it was throwing noisy errors. Fix: made the insert an idempotent upsert keyed on the unique constraint and treated the duplicate-key path as success. Lesson: idempotency needs a guarantee at the datastore, not just the cache.

**12. How did you test it?**
Unit tests on the FSM transition rules, integration tests against a real MySQL via Testcontainers, contract tests on the OpenAPI + event schemas so a breaking change fails CI, and a load test replaying a synthetic 5k-row batch to validate throughput and idempotency under concurrency.

---

## 11. Things to avoid saying (so you stay realistic)

- Don't claim you personally built the sequencing or bioinformatics pipelines — you *integrated* with them. Overclaiming genomics internals is where a bluff falls apart.
- Don't invent exotic tech you can't defend. The stack above is deliberately mainstream; know each item one layer deeper than you say it.
- Don't say "we had zero downtime ever" or "100% test coverage" — say targets/SLOs and trade-offs. Seniors talk in trade-offs.
- If you don't know a detail they ask, reason from principles out loud rather than inventing a fake fact. That reads as *more* senior, not less.

---

## 12. 30-second verbal summary (memorize this)

> "I designed and built Nucleus, a Node.js/TypeScript microservice on AWS that's the system of record for genetic-test orders. It ingests orders two ways — synchronously from our web portal, and in nightly batches of 5,000-plus from partner labs like Quest Diagnostics — and drives each order through an explicit lifecycle state machine from sample collection, through sequencing and bioinformatics, to a geneticist-signed report. It's backed by MySQL on RDS with Flyway migrations, uses SQS/SNS to stay decoupled from the heavy pipelines, Cognito for auth, and issues short-lived S3 presigned URLs so patients can securely download their reports. I built it as its own service because order intake is always-on, transactional, and revenue-critical, with a strict PHI boundary — completely different in shape and risk from the batch compute pipelines around it."
