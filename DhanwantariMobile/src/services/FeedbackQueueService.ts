/**
 * FeedbackQueueService.ts
 *
 * Persistent SQLite-backed queue for thumbs-down feedback items.
 * When a user gives a thumbs-down on any AI response, the item is
 * enqueued here and later processed by FeedbackSyncWorker when
 * network is available.
 *
 * Survives app kill/restart — all state is in SQLite, not Redux.
 */

import {nanoid} from '@reduxjs/toolkit';
import {getDB} from './db';
import type {FeedbackQueueItem, FeedbackQueueStatus} from '@store/types';

const MAX_RETRIES = 3;

// ─── Enqueue ──────────────────────────────────────────────────────────────────

export async function enqueueFeedback(
  messageId: string,
  profileId: string,
  originalQuery: string,
  originalResponse: string,
  context: string = '',
): Promise<FeedbackQueueItem> {
  const db = getDB();
  const now = new Date().toISOString();
  const item: FeedbackQueueItem = {
    id: nanoid(),
    messageId,
    profileId,
    originalQuery,
    originalResponse,
    context,
    status: 'pending',
    retryCount: 0,
    bedrockResponse: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.execute(
    `INSERT INTO feedback_queue
       (id, message_id, profile_id, original_query, original_response,
        context, status, retry_count, bedrock_response, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      item.id,
      item.messageId,
      item.profileId,
      item.originalQuery,
      item.originalResponse,
      item.context,
      item.status,
      item.retryCount,
      item.bedrockResponse,
      item.createdAt,
      item.updatedAt,
    ],
  );

  return item;
}

// ─── Query ────────────────────────────────────────────────────────────────────

export async function getPendingItems(): Promise<FeedbackQueueItem[]> {
  const db = getDB();
  const res = await db.execute(
    `SELECT * FROM feedback_queue
     WHERE status IN ('pending', 'failed')
       AND retry_count < ?
     ORDER BY created_at ASC`,
    [MAX_RETRIES],
  );
  return (res.rows ?? []).map(rowToItem);
}

export async function getQueueCount(): Promise<number> {
  const db = getDB();
  const res = await db.execute(
    `SELECT COUNT(*) as cnt FROM feedback_queue
     WHERE status IN ('pending', 'failed')
       AND retry_count < ?`,
    [MAX_RETRIES],
  );
  return Number((res.rows ?? [])[0]?.cnt ?? 0);
}

// ─── Status updates ───────────────────────────────────────────────────────────

export async function markProcessing(id: string): Promise<void> {
  await updateStatus(id, 'processing');
}

export async function markCompleted(
  id: string,
  bedrockResponse: string,
): Promise<void> {
  const db = getDB();
  await db.execute(
    `UPDATE feedback_queue
     SET status = 'completed', bedrock_response = ?, updated_at = ?
     WHERE id = ?`,
    [bedrockResponse, new Date().toISOString(), id],
  );
}

export async function markFailed(id: string): Promise<void> {
  const db = getDB();
  await db.execute(
    `UPDATE feedback_queue
     SET status = 'failed', retry_count = retry_count + 1, updated_at = ?
     WHERE id = ?`,
    [new Date().toISOString(), id],
  );
}

async function updateStatus(
  id: string,
  status: FeedbackQueueStatus,
): Promise<void> {
  const db = getDB();
  await db.execute(
    `UPDATE feedback_queue SET status = ?, updated_at = ? WHERE id = ?`,
    [status, new Date().toISOString(), id],
  );
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

export async function removeCompleted(): Promise<void> {
  const db = getDB();
  await db.execute(`DELETE FROM feedback_queue WHERE status = 'completed'`);
}

// ─── Row mapper ───────────────────────────────────────────────────────────────

function rowToItem(r: Record<string, unknown>): FeedbackQueueItem {
  return {
    id: r.id as string,
    messageId: r.message_id as string,
    profileId: r.profile_id as string,
    originalQuery: r.original_query as string,
    originalResponse: r.original_response as string,
    context: (r.context as string) ?? '',
    status: r.status as FeedbackQueueStatus,
    retryCount: Number(r.retry_count ?? 0),
    bedrockResponse: (r.bedrock_response as string) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}
