import { createGateway, embed } from "ai";
import { sql, type SQL } from "drizzle-orm";
import { db } from "../db/client";
import {
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
  JOB_EMBEDDING_RECIPE,
  COMPANY_EMBEDDING_RECIPE,
  embeddingKey,
  validateEmbedding,
} from "./embedding-config";

const queryRecipe = "semantic-query-v1";
const inflight = new Map<
  string,
  Promise<{ vector: number[]; cacheHit: boolean }>
>();

// Ordinary query counts describe exact/lexical matches. Do not expose those
// names for nearest-neighbor candidates, which can include unrelated records.
export function semanticResult<
  T extends { totalMatches: number; hasMore: boolean },
>(result: T) {
  const { totalMatches, hasMore, ...rest } = result;
  return { ...rest, totalCandidates: totalMatches, hasMoreCandidates: hasMore };
}

// Exact text equality invalidates stale descriptions automatically and survives
// replacement job IDs. The content cache, not a job ID, owns the paid vector.
export function semanticSource(
  base: SQL,
  entity: "jobs" | "companies",
  vector?: number[],
) {
  if (vector) validateEmbedding(vector);
  const text =
    entity === "jobs"
      ? sql`concat('Company: ', e.company_name, E'\nTitle: ', e.title, E'\nTeam: ', coalesce(e.department,e.focus), E'\nSkills: ', array_to_string(e.skills, ', '), E'\nDescription:\n', e.description)`
      : sql`concat('Company: ', e.name, E'\nIndustry: ', e.industry, E'\nTagline: ', coalesce(e.tagline,'null'), E'\nAbout: ', e.description)`;
  const recipe =
    entity === "jobs" ? JOB_EMBEDDING_RECIPE : COMPANY_EMBEDDING_RECIPE;
  return sql`SELECT e.*, ec.key IS NOT NULL AS vector_covered
    ${vector ? sql`, 1 - (ec.embedding <=> ${JSON.stringify(vector)}::vector) AS semantic_score` : sql``}
    FROM (${base}) e LEFT JOIN embedding_cache ec
    ON ec.content_text = ${text} AND ec.model_id = ${EMBEDDING_MODEL}
      AND ec.dimensions = ${EMBEDDING_DIMENSIONS} AND ec.recipe = ${recipe} AND ec.input_type = 'document'`;
}

export function semanticCoverageQuery(base: SQL, entity: "jobs" | "companies") {
  return sql`WITH coverage AS (${semanticSource(base, entity)})
    SELECT count(*) AS eligible, count(*) FILTER (WHERE vector_covered) AS embedded
    ${
      entity === "jobs"
        ? sql`, (SELECT count(DISTINCT company_slug) FROM coverage WHERE vector_covered) AS company_matches,
      (SELECT jsonb_agg(summary) FROM (SELECT jsonb_build_object('companySlug',company_slug,'companyName',company_name,'jobCount',count(*)) AS summary
        FROM coverage WHERE vector_covered GROUP BY company_slug,company_name ORDER BY company_name LIMIT 50) company_counts) AS company_summaries`
        : sql``
    }
    FROM coverage`;
}

export function semanticRankingQuery(
  base: SQL,
  entity: "jobs" | "companies",
  vector: number[],
  limit: number,
  sortBy: string,
) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50)
    throw new Error("Invalid semantic limit");
  const order =
    entity === "jobs"
      ? sortBy === "salary"
        ? sql`CASE WHEN salary_currency = 'USD' AND salary_period = 'year' THEN salary_minimum::numeric END DESC NULLS LAST, semantic_score DESC`
        : sortBy === "postedAt"
          ? sql`posted_at DESC NULLS LAST, semantic_score DESC`
          : sql`semantic_score DESC`
      : sortBy === "name"
        ? sql`name ASC, semantic_score DESC`
        : sortBy === "totalFunding"
          ? sql`CASE WHEN funding_currency = 'USD' THEN total_funding END DESC NULLS LAST, semantic_score DESC`
          : sortBy === "employees"
            ? sql`employee_min DESC NULLS LAST, semantic_score DESC`
            : sortBy === "foundedYear"
              ? sql`founded_year DESC NULLS LAST, semantic_score DESC`
              : sql`semantic_score DESC`;
  const tie = entity === "jobs" ? sql`title, company_slug, id` : sql`slug`;
  return sql`WITH covered AS (SELECT * FROM (${semanticSource(base, entity, vector)}) candidates WHERE vector_covered)
    SELECT *, count(*) OVER() AS semantic_candidates FROM covered ORDER BY ${order}, ${tie} LIMIT ${limit}`;
}

function decodeVector(value: unknown): number[] {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  validateEmbedding(parsed);
  return parsed as number[];
}

export const queryEmbeddingSettings = {
  maxRetries: 0,
  providerOptions: {
    voyage: {
      inputType: "query",
      outputDimension: EMBEDDING_DIMENSIONS,
      outputDtype: "float",
      truncation: false,
    },
    gateway: { only: ["voyage"] },
  },
} as const;

export type QueryEmbeddingDependencies = {
  execute: (query: SQL) => Promise<{ rows: Record<string, unknown>[] }>;
  generate: (text: string) => Promise<{
    embedding: number[];
    usage?: unknown;
    providerMetadata?: unknown;
    warnings?: unknown[];
  }>;
};

export async function queryEmbedding(
  text: string,
  dependencies?: QueryEmbeddingDependencies,
): Promise<{ vector: number[]; cacheHit: boolean }> {
  if (!text.trim() || text.length > 500)
    throw new Error("Invalid semantic query");
  const key = embeddingKey(text, "query", queryRecipe);
  const running = inflight.get(key);
  if (running) return running.then((value) => ({ ...value, cacheHit: true }));
  const task = (async () => {
    const execute =
      dependencies?.execute ?? ((query: SQL) => db.execute(query));
    const cached =
      await execute(sql`SELECT embedding FROM embedding_cache WHERE key=${key}
      AND model_id=${EMBEDDING_MODEL} AND dimensions=${EMBEDDING_DIMENSIONS} AND recipe=${queryRecipe} AND input_type='query' AND content_text=${text}`);
    if (cached.rows[0])
      return { vector: decodeVector(cached.rows[0].embedding), cacheHit: true };
    if (
      (!dependencies && !process.env.AI_GATEWAY_API_KEY) ||
      process.env.LOCUS_SEMANTIC_SEARCH === "off"
    )
      throw new Error("Semantic embedding unavailable");
    // Persist the reservation BEFORE sending anything. Unique keys prevent
    // duplicate paid calls across processes and block retries of ambiguous
    // timeouts. A fixed slot cap bounds NEW live queries to 200/day globally.
    const day = new Date().toISOString().slice(0, 10);
    const claim =
      await execute(sql`INSERT INTO embedding_requests (key,day,slot,state)
      SELECT ${key}, ${day}, slots.slot, 'pending' FROM generate_series(1,200) AS slots(slot)
      WHERE NOT EXISTS (SELECT 1 FROM embedding_requests r WHERE r.day=${day} AND r.slot=slots.slot)
        AND (SELECT count(*) FROM embedding_requests WHERE created_at > now() - interval '60 seconds') < 5
      ORDER BY slots.slot LIMIT 1 ON CONFLICT DO NOTHING RETURNING key`);
    if (!claim.rows.length)
      throw new Error(
        "Embedding request already reserved or daily limit reached",
      );
    try {
      const result = dependencies
        ? await dependencies.generate(text)
        : await embed({
            model: createGateway({
              apiKey: process.env.AI_GATEWAY_API_KEY,
            }).embeddingModel(EMBEDDING_MODEL),
            value: text,
            ...queryEmbeddingSettings,
            abortSignal: AbortSignal.timeout(15000),
          });
      validateEmbedding(result.embedding);
      if (result.warnings?.length)
        throw new Error("Unexpected embedding provider warning");
      await execute(sql`INSERT INTO embedding_cache (key,model_id,dimensions,recipe,input_type,content_text,embedding)
        VALUES (${key},${EMBEDDING_MODEL},${EMBEDDING_DIMENSIONS},${queryRecipe},'query',${text},${JSON.stringify(result.embedding)}::vector)
        ON CONFLICT (key) DO NOTHING`);
      await execute(
        sql`UPDATE embedding_requests SET state='complete', receipt=${JSON.stringify({ usage: result.usage, providerMetadata: result.providerMetadata })}::jsonb WHERE key=${key}`,
      );
      return { vector: result.embedding, cacheHit: false };
    } catch (error) {
      // Failed reservations are NOT deleted: operators must inspect billing
      // before explicitly releasing a key. Existing lexical tools still work.
      await execute(
        sql`UPDATE embedding_requests SET state='failed' WHERE key=${key}`,
      ).catch(() => undefined);
      throw error;
    }
  })();
  inflight.set(key, task);
  try {
    return await task;
  } finally {
    inflight.delete(key);
  }
}

export async function retrieveSemantic(
  base: SQL,
  entity: "jobs" | "companies",
  text: string,
  limit: number,
  sortBy: string,
) {
  if (process.env.LOCUS_SEMANTIC_SEARCH === "off")
    throw new Error("Semantic search disabled");
  const coverage = await db.execute(semanticCoverageQuery(base, entity));
  const eligible = Number(coverage.rows[0]?.eligible ?? 0);
  const embedded = Number(coverage.rows[0]?.embedded ?? 0);
  const metadata = {
    mode: "semantic" as const,
    query: text,
    model: EMBEDDING_MODEL,
    eligibleRecords: eligible,
    embeddedRecords: embedded,
    unembeddedRecords: eligible - embedded,
    completeCoverage: eligible === embedded,
    countMeaning:
      "Counts are vector-covered candidates satisfying exact filters, not proven semantic matches.",
    policy:
      "Semantic scores are ranking signals, not probabilities or proof. Review returned descriptions. Unembedded records are excluded from vector ranking but remain searchable using ordinary tools. No exhaustive dataset-wide semantic claim is supported with incomplete coverage.",
  };
  if (!embedded)
    return {
      rows: [],
      metadata: {
        ...metadata,
        queryCacheHit: null,
        queryEmbeddingRequested: false,
      },
      unavailable: "No current vectors within the exact filters",
    };
  const query = await queryEmbedding(text);
  const result = await db.execute(
    semanticRankingQuery(base, entity, query.vector, limit, sortBy),
  );
  return {
    rows: result.rows.map((row) => ({
      ...row,
      total_matches: embedded,
      ...(entity === "jobs"
        ? {
            company_matches: coverage.rows[0]?.company_matches,
            company_summaries: coverage.rows[0]?.company_summaries ?? [],
          }
        : {}),
    })),
    metadata: {
      ...metadata,
      queryCacheHit: query.cacheHit,
      queryEmbeddingRequested: true,
    },
  };
}
