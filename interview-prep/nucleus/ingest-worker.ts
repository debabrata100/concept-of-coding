/**
 * Batch Ingest Worker — glimpse of the real shape (Node.js / TypeScript)
 * ---------------------------------------------------------------------
 * Runs as a SEPARATE PROCESS from the Nucleus API, but from the SAME codebase
 * and SAME database. Started with e.g.  `node dist/main.js worker`.
 *
 * Flow:  SQS message ("file X landed in S3")
 *          -> stream + parse the file from S3
 *          -> process rows with BOUNDED concurrency (not one thread per row)
 *          -> each row: validate -> idempotency check -> atomic DB insert
 *          -> record successes/failures -> reconcile
 */

import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import pLimit from "p-limit"; // bounds how many rows run at once
import { parse } from "csv-parse"; // streaming CSV parser
import { db } from "./db"; // shared Knex/TypeORM pool — SAME db as the API
import { redis } from "./redis";
import { OrderService } from "./order/order.service"; // shared domain logic, reused by the API too

const sqs = new SQSClient({});
const s3 = new S3Client({});
const QUEUE_URL = process.env.INGEST_QUEUE_URL!;
const CONCURRENCY = Number(process.env.INGEST_CONCURRENCY ?? 20);

/* ────────────────────────────────────────────────────────────────
 * 1. THE POLL LOOP — this is how the worker "receives the request"
 *    It long-polls SQS forever. No HTTP server; the queue IS the inbox.
 * ──────────────────────────────────────────────────────────────── */
async function runWorker() {
  console.log("Batch ingest worker started, polling SQS...");
  while (true) {
    const res = await sqs.send(
      new ReceiveMessageCommand({
        QueueUrl: QUEUE_URL,
        MaxNumberOfMessages: 1, // one file per message
        WaitTimeSeconds: 20, // long-poll: cheap, no busy-spin
        VisibilityTimeout: 900, // 15 min to finish before SQS re-delivers
      }),
    );

    for (const msg of res.Messages ?? []) {
      try {
        const { bucket, key, clientId } = JSON.parse(msg.Body!); // S3 event details
        await processFile(bucket, key, clientId);
        // Only delete the message AFTER success — if we crash, SQS re-delivers.
        await sqs.send(
          new DeleteMessageCommand({
            QueueUrl: QUEUE_URL,
            ReceiptHandle: msg.ReceiptHandle!,
          }),
        );
      } catch (err) {
        // Don't delete -> message returns to the queue -> retried.
        // After N failures SQS moves it to the Dead-Letter Queue + alerts us.
        console.error("File processing failed, will retry via SQS", err);
      }
    }
  }
}

/* ────────────────────────────────────────────────────────────────
 * 2. PROCESS ONE FILE — stream it, fan rows out with bounded concurrency
 * ──────────────────────────────────────────────────────────────── */
async function processFile(bucket: string, key: string, clientId: string) {
  // Create the "receipt" row so we can track/reconcile this file.
  const [batchJobId] = await db("batch_jobs").insert({
    client_id: clientId,
    source_file_key: key,
    status: "PROCESSING",
    started_at: new Date(),
  });

  const limit = pLimit(CONCURRENCY); // <-- e.g. max 20 rows in flight at once
  const tasks: Promise<"ok" | "skip" | "fail">[] = [];

  // Stream the object from S3 straight into the CSV parser — never load 5k rows into RAM.
  const s3Object = await s3.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  const parser = (s3Object.Body as NodeJS.ReadableStream).pipe(
    parse({ columns: true, trim: true }),
  );

  let rowNumber = 0;
  for await (const row of parser) {
    const n = ++rowNumber;
    // Wrap each row in the limiter: it queues if 20 are already running.
    tasks.push(limit(() => processRow(clientId, batchJobId, n, row)));
  }

  const results = await Promise.all(tasks); // wait for every row to settle
  const succeeded = results.filter((r) => r === "ok" || r === "skip").length;
  const failed = results.filter((r) => r === "fail").length;

  await db("batch_jobs")
    .where({ id: batchJobId })
    .update({
      total_rows: rowNumber,
      succeeded,
      failed,
      status: failed === 0 ? "COMPLETED" : "PARTIAL",
      finished_at: new Date(),
    });
  // (reconciliation report back to the partner would be triggered here)
}

/* ────────────────────────────────────────────────────────────────
 * 3. PROCESS ONE ROW — validate -> idempotency -> atomic insert
 *    This is the same OrderService.createOrder the API uses, so logic lives once.
 * ──────────────────────────────────────────────────────────────── */
async function processRow(
  clientId: string,
  batchJobId: number,
  rowNumber: number,
  row: Record<string, string>,
): Promise<"ok" | "skip" | "fail"> {
  try {
    // 3a. Validate
    const dto = validateRow(row); // throws ValidationError with a code if bad

    // 3b. Idempotency — have we already ingested this partner order?
    const idempotencyKey = `ingest:${clientId}:${dto.partnerOrderNumber}`;
    const firstTime = await redis.set(idempotencyKey, "1", "EX", 86400, "NX"); // NX = only if absent
    if (!firstTime) return "skip"; // already processed -> no-op

    // 3c. Atomic create (patient + order + items + history in ONE transaction).
    //     Reuses the exact domain logic the synchronous API endpoint uses.
    await OrderService.createOrderFromBatch(dto, clientId, batchJobId);
    return "ok";
  } catch (err: any) {
    // Duplicate-key from the DB unique constraint = someone else won the race -> treat as done.
    if (err.code === "ER_DUP_ENTRY") return "skip";

    // Real failure: dead-letter this ONE row, keep the file going.
    await db("batch_job_errors").insert({
      batch_job_id: batchJobId,
      row_number: rowNumber,
      raw_payload: JSON.stringify(row),
      error_code: err.code ?? "UNKNOWN",
      error_detail: err.message,
    });
    return "fail";
  }
}

runWorker().catch((err) => {
  console.error("Worker crashed", err);
  process.exit(1);
});
