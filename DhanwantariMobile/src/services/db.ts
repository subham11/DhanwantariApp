/**
 * db.ts
 * Central SQLite database service using op-sqlite + sqlite-vec.
 *
 * Schema:
 *   profiles        — user profiles (replaces redux-persist AsyncStorage for profiles)
 *   diseases        — all 146 disease records from symptom_disease_mapping.json
 *   disease_symptoms — normalised symptom→disease rows for fast reverse lookup
 *   reports         — indexed document reports (from reportIndexer)
 *   report_chunks   — pageIndexMd tree nodes per report
 *   disease_vectors — vec0 virtual table for semantic disease search (Step 2)
 *
 * sqlite-vec is loaded at open time; vec0 virtual table is created but
 * populated only when embeddings are available (Step 2).
 */

import {open, IOS_LIBRARY_PATH} from '@op-engineering/op-sqlite';
import type {DB} from '@op-engineering/op-sqlite';

let _db: DB | null = null;

// ─── Open & initialise ────────────────────────────────────────────────────────

export function getDB(): DB {
  if (!_db) {
    throw new Error('Database not initialised. Call initDB() first.');
  }
  return _db;
}

export async function initDB(): Promise<void> {
  if (_db) return;

  _db = open({
    name: 'dhanwantari.db',
    location: IOS_LIBRARY_PATH,
  });

  await createSchema(_db);
}

// ─── Schema ───────────────────────────────────────────────────────────────────

async function createSchema(db: DB): Promise<void> {
  // Profiles
  await db.execute(`
    CREATE TABLE IF NOT EXISTS profiles (
      id              TEXT PRIMARY KEY,
      first_name      TEXT NOT NULL,
      last_name       TEXT NOT NULL,
      age             INTEGER NOT NULL,
      gender          TEXT NOT NULL,
      height_cm       REAL NOT NULL,
      weight_kg       REAL NOT NULL,
      activity_level  TEXT NOT NULL,
      bmi             REAL NOT NULL,
      bmi_category    TEXT NOT NULL,
      maintenance_cal REAL NOT NULL,
      hereditary      TEXT NOT NULL DEFAULT '[]',
      created_at      TEXT NOT NULL,
      last_used_at    TEXT NOT NULL
    );
  `);

  // Diseases (full record)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS diseases (
      id                  TEXT PRIMARY KEY,
      name                TEXT NOT NULL,
      file                TEXT NOT NULL,
      symptom_count       INTEGER NOT NULL,
      symptoms_json       TEXT NOT NULL,
      tests               TEXT NOT NULL DEFAULT '',
      generic_medicines   TEXT NOT NULL DEFAULT '',
      janaushadhi         TEXT NOT NULL DEFAULT '',
      ayurvedic           TEXT NOT NULL DEFAULT '',
      india_specific      TEXT NOT NULL DEFAULT '',
      important_notes     TEXT NOT NULL DEFAULT '',
      gender              TEXT NOT NULL DEFAULT 'both',
      category_tag        TEXT NOT NULL DEFAULT ''
    );
  `);

  // Normalised symptom→disease mapping (reverse index as SQL rows for joins)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS disease_symptoms (
      disease_id  TEXT NOT NULL REFERENCES diseases(id),
      symptom     TEXT NOT NULL,
      PRIMARY KEY (disease_id, symptom)
    );
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_disease_symptoms_symptom
      ON disease_symptoms(symptom);
  `);

  // Indexed report documents
  await db.execute(`
    CREATE TABLE IF NOT EXISTS reports (
      id          TEXT PRIMARY KEY,
      doc_name    TEXT NOT NULL,
      indexed_at  TEXT NOT NULL,
      tree_json   TEXT NOT NULL
    );
  `);

  // Individual tree-node chunks per report (for keyword/vector search)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS report_chunks (
      id          TEXT PRIMARY KEY,
      report_id   TEXT NOT NULL REFERENCES reports(id),
      node_title  TEXT NOT NULL,
      node_id     TEXT,
      summary     TEXT,
      text        TEXT,
      start_idx   INTEGER,
      end_idx     INTEGER
    );
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_report_chunks_report
      ON report_chunks(report_id);
  `);

  // FTS5 full-text search over chunk text
  await db.execute(`
    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts
      USING fts5(node_title, text, content='report_chunks', content_rowid='rowid');
  `);

  // sqlite-vec: disease embedding table (populated in Step 2)
  // 384 dims = MiniLM-L6 output size; change if using a different model
  await db.execute(`
    CREATE VIRTUAL TABLE IF NOT EXISTS disease_vectors
      USING vec0(
        disease_id TEXT PRIMARY KEY,
        embedding  FLOAT[384]
      );
  `);

  // Feedback queue — persistent queue for thumbs-down items to re-answer via Bedrock
  await db.execute(`
    CREATE TABLE IF NOT EXISTS feedback_queue (
      id                TEXT PRIMARY KEY,
      message_id        TEXT NOT NULL,
      profile_id        TEXT NOT NULL,
      original_query    TEXT NOT NULL,
      original_response TEXT NOT NULL,
      context           TEXT NOT NULL DEFAULT '',
      status            TEXT NOT NULL DEFAULT 'pending',
      retry_count       INTEGER NOT NULL DEFAULT 0,
      bedrock_response  TEXT,
      created_at        TEXT NOT NULL,
      updated_at        TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_feedback_queue_status
      ON feedback_queue(status);
  `);
}

// ─── Profile CRUD ─────────────────────────────────────────────────────────────

import type {UserProfile} from '@store/types';

export async function upsertProfile(p: UserProfile): Promise<void> {
  const db = getDB();
  await db.execute(
    `INSERT OR REPLACE INTO profiles
       (id, first_name, last_name, age, gender, height_cm, weight_kg,
        activity_level, bmi, bmi_category, maintenance_cal, hereditary,
        created_at, last_used_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      p.id, p.firstName, p.lastName, p.age, p.gender,
      p.heightCm, p.weightKg, p.activityLevel,
      p.bmi, p.bmiCategory, p.maintenanceCalories,
      JSON.stringify(p.hereditaryDiseases),
      p.createdAt, p.lastUsedAt,
    ],
  );
}

export async function loadAllProfiles(): Promise<UserProfile[]> {
  const db = getDB();
  const res = await db.execute('SELECT * FROM profiles ORDER BY last_used_at DESC;');
  return (res.rows ?? []).map(rowToProfile);
}

export async function deleteProfileById(id: string): Promise<void> {
  const db = getDB();
  await db.execute('DELETE FROM profiles WHERE id = ?;', [id]);
}

function rowToProfile(r: Record<string, unknown>): UserProfile {
  return {
    id: r.id as string,
    firstName: r.first_name as string,
    lastName: r.last_name as string,
    age: r.age as number,
    gender: r.gender as UserProfile['gender'],
    heightCm: r.height_cm as number,
    weightKg: r.weight_kg as number,
    activityLevel: r.activity_level as UserProfile['activityLevel'],
    bmi: r.bmi as number,
    bmiCategory: r.bmi_category as string,
    maintenanceCalories: r.maintenance_cal as number,
    hereditaryDiseases: JSON.parse(r.hereditary as string),
    createdAt: r.created_at as string,
    lastUsedAt: r.last_used_at as string,
  };
}

// ─── Disease seeding ──────────────────────────────────────────────────────────

import type {Disease} from '@store/types';

export async function seedDiseases(diseases: Disease[]): Promise<void> {
  const db = getDB();

  // Skip if already seeded
  const countRes = await db.execute('SELECT COUNT(*) as cnt FROM diseases;');
  const count = (countRes.rows?.[0]?.cnt ?? 0) as number;
  if (count >= diseases.length) return;

  await db.transaction(async tx => {
    for (const d of diseases) {
      await tx.execute(
        `INSERT OR REPLACE INTO diseases
           (id, name, file, symptom_count, symptoms_json, tests,
            generic_medicines, janaushadhi, ayurvedic,
            india_specific, important_notes, gender, category_tag)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          d.id, d.name, d.file, d.symptom_count,
          JSON.stringify(d.symptoms),
          d.tests ?? '', d.generic_medicines ?? '',
          d.janaushadhi_medicines ?? '', d.ayurvedic_medicines ?? '',
          d.india_specific ?? '', d.important_notes ?? '',
          d.gender ?? 'both', d.category_tag ?? '',
        ],
      );

      for (const symptom of d.symptoms) {
        await tx.execute(
          `INSERT OR IGNORE INTO disease_symptoms (disease_id, symptom)
           VALUES (?, ?)`,
          [d.id, symptom],
        );
      }
    }
  });
}

// ─── Disease query ────────────────────────────────────────────────────────────

/**
 * Return disease IDs that match ANY of the given symptoms (reverse index via SQL).
 */
export async function getDiseasesForSymptoms(
  symptoms: string[],
): Promise<{diseaseId: string; matchCount: number}[]> {
  if (symptoms.length === 0) return [];
  const db = getDB();
  const placeholders = symptoms.map(() => '?').join(',');
  const res = await db.execute(
    `SELECT disease_id, COUNT(*) as match_count
     FROM disease_symptoms
     WHERE symptom IN (${placeholders})
     GROUP BY disease_id
     ORDER BY match_count DESC;`,
    symptoms,
  );
  return (res.rows ?? []).map(r => ({
    diseaseId: r.disease_id as string,
    matchCount: r.match_count as number,
  }));
}

export async function getDiseaseById(id: string): Promise<Disease | null> {
  const db = getDB();
  const res = await db.execute('SELECT * FROM diseases WHERE id = ?;', [id]);
  const row = res.rows?.[0];
  if (!row) return null;
  return rowToDisease(row);
}

function rowToDisease(r: Record<string, unknown>): Disease {
  return {
    id: r.id as string,
    name: r.name as string,
    file: r.file as string,
    symptom_count: r.symptom_count as number,
    symptoms: JSON.parse(r.symptoms_json as string),
    symptoms_by_category: {},
    tests: r.tests as string,
    generic_medicines: r.generic_medicines as string,
    janaushadhi_medicines: r.janaushadhi as string,
    ayurvedic_medicines: r.ayurvedic as string,
    india_specific: r.india_specific as string,
    important_notes: r.important_notes as string,
    gender: r.gender as Disease['gender'],
    category_tag: r.category_tag as string,
  };
}

// ─── Report storage ───────────────────────────────────────────────────────────

import type {PageIndexResult} from 'react-native-pageindex';
import type {TreeNode} from 'react-native-pageindex';

export async function saveReport(
  id: string,
  docName: string,
  result: PageIndexResult,
): Promise<void> {
  const db = getDB();
  const now = new Date().toISOString();

  await db.execute(
    `INSERT OR REPLACE INTO reports (id, doc_name, indexed_at, tree_json)
     VALUES (?,?,?,?)`,
    [id, docName, now, JSON.stringify(result.structure)],
  );

  // Flatten tree nodes → individual chunk rows
  const chunks = result.structure.flatMap(flattenTree);
  await db.transaction(async tx => {
    // Remove old chunks for this report
    await tx.execute('DELETE FROM report_chunks WHERE report_id = ?;', [id]);
    for (const c of chunks) {
      await tx.execute(
        `INSERT INTO report_chunks
           (id, report_id, node_title, node_id, summary, text, start_idx, end_idx)
         VALUES (?,?,?,?,?,?,?,?)`,
        [
          `${id}_${c.node_id ?? c.start_index}`,
          id,
          c.title ?? '',
          c.node_id ?? null,
          c.summary ?? null,
          c.text ?? null,
          c.start_index ?? null,
          c.end_index ?? null,
        ],
      );
    }
  });

  // Rebuild FTS index for this report
  await db.execute(
    `INSERT INTO chunks_fts(chunks_fts) VALUES('rebuild');`,
  );
}

function flattenTree(node: TreeNode): TreeNode[] {
  const nodes: TreeNode[] = [node];
  for (const child of node.nodes ?? []) {
    nodes.push(...flattenTree(child));
  }
  return nodes;
}

// ─── Classification management ────────────────────────────────────────────────

/**
 * Return all distinct disease category tags with their disease counts.
 * Sorted by count descending.
 */
export async function getAllDiseaseCategories(): Promise<
  {category: string; count: number}[]
> {
  const db = getDB();
  const res = await db.execute(
    `SELECT category_tag as category, COUNT(*) as count
     FROM diseases
     GROUP BY category_tag
     ORDER BY count DESC;`,
  );
  return (res.rows ?? []).map(r => ({
    category: r.category as string,
    count: r.count as number,
  }));
}

/**
 * Return all diseases belonging to a given category, ordered by name.
 */
export async function getDiseasesByCategory(
  category: string,
): Promise<Disease[]> {
  const db = getDB();
  const res = await db.execute(
    `SELECT * FROM diseases WHERE category_tag = ? ORDER BY name ASC;`,
    [category],
  );
  return (res.rows ?? []).map(rowToDisease);
}

/**
 * Update a single disease's category_tag.
 */
export async function updateDiseaseCategory(
  diseaseId: string,
  newCategory: string,
): Promise<void> {
  const db = getDB();
  await db.execute(
    `UPDATE diseases SET category_tag = ? WHERE id = ?;`,
    [newCategory.trim(), diseaseId],
  );
}

/**
 * Rename every disease that has oldCategory to newCategory.
 */
export async function renameCategory(
  oldCategory: string,
  newCategory: string,
): Promise<void> {
  const db = getDB();
  await db.execute(
    `UPDATE diseases SET category_tag = ? WHERE category_tag = ?;`,
    [newCategory.trim(), oldCategory],
  );
}

/**
 * Move all diseases from fromCategory to toCategory (used when merging/deleting).
 */
export async function mergeDiseaseCategory(
  fromCategory: string,
  toCategory: string,
): Promise<void> {
  const db = getDB();
  await db.execute(
    `UPDATE diseases SET category_tag = ? WHERE category_tag = ?;`,
    [toCategory.trim(), fromCategory],
  );
}

/**
 * Return all diseases ordered by name.
 */
export async function getAllDiseases(): Promise<Disease[]> {
  const db = getDB();
  const res = await db.execute(
    `SELECT * FROM diseases ORDER BY name ASC;`,
  );
  return (res.rows ?? []).map(rowToDisease);
}

export async function searchReportFTS(
  reportId: string,
  query: string,
  limit = 5,
): Promise<{nodeTitle: string; snippet: string}[]> {
  const db = getDB();
  const res = await db.execute(
    `SELECT rc.node_title,
            snippet(chunks_fts, 1, '<b>', '</b>', '…', 20) as snippet
     FROM chunks_fts
     JOIN report_chunks rc ON rc.rowid = chunks_fts.rowid
     WHERE chunks_fts MATCH ?
       AND rc.report_id = ?
     ORDER BY rank
     LIMIT ?;`,
    [query, reportId, limit],
  );
  return (res.rows ?? []).map(r => ({
    nodeTitle: r.node_title as string,
    snippet: r.snippet as string,
  }));
}
