/**
 * T-105 — the raw-fragment decoder.
 *
 * `project.getInsights` threw `at.getTime is not a function` on every call.
 * The offending statement is an aggregate over a timestamp column:
 *
 *   db.select({
 *     at:       sql<Date | null>`MAX(${commitsTable.authorDate})`,
 *     firstAt:  sql<Date | null>`MIN(${commitsTable.authorDate})`,
 *   })
 *
 * `sql<Date | null>` is a TypeScript assertion and nothing else — it is erased
 * before the code runs, and it does not tell drizzle what the driver handed
 * back. A raw `SQL` fragment has no column attached, so `mapResultRow` looks up
 * `field.sql.decoder`, finds `undefined`, and passes the driver's raw value
 * straight through. Over `neon-http` that value is the `timestamp` text Neon
 * returns, not a `Date`, and `spanDays` immediately calls `.getTime()` on it.
 *
 * The sibling aggregate one statement earlier cannot hit this because it casts
 * to `::date::text` and says so: it returns a string and is typed as one. The
 * one below it cannot hit it because a real column carries its own
 * `mapFromDriverValue`. Only the lying one breaks.
 *
 * This suite runs real drizzle over a stubbed Neon client, because the whole
 * failure lives in the row decoder and a mocked `db.select` — which returns
 * whatever `Date` objects the test hands it — cannot see it. That is exactly how
 * the bug shipped: the service's own test fixture hard-coded `Date` objects that
 * the driver never produces, so it asserted a shape the query cannot return.
 */

import { describe, it, expect } from "vitest";
import { drizzle } from "drizzle-orm/neon-http";
import { and, eq, max, min, sql, type SQL } from "drizzle-orm";
import { commitsTable } from "@/db/schema";

/** What Neon sends back for a `timestamp without time zone`: text. */
const DRIVER_LATEST = "2026-01-20T00:00:00";
const DRIVER_EARLIEST = "2025-11-02T00:00:00";

const PROJECT_ID = "22222222-2222-4222-8222-222222222222";

/**
 * A Neon client that never touches the network and answers every query with the
 * same single row. `transaction` is the entry point `neon-http`'s `batch()` uses,
 * and rows arrive as arrays because it requests `arrayMode: true` — which is why
 * every value reaches `mapResultRow` still unmapped.
 */
function stubClient(row: unknown[]) {
  const one = () => ({ rows: [row], fields: [], rowAsArray: true });
  return {
    transaction: () => [one()],
    query: one,
    queryObjects: one,
  };
}

function dbOver(row: unknown[]) {
  return drizzle(stubClient(row) as never);
}

/** The statement as it is written in `getProjectInsights`, with `.mapWith`. */
const statementSix = (db: ReturnType<typeof dbOver>) =>
  db
    .select({
      at: sql<Date | null>`MAX(${commitsTable.authorDate})`.mapWith(
        commitsTable.authorDate,
      ),
      firstAt: sql<Date | null>`MIN(${commitsTable.authorDate})`.mapWith(
        commitsTable.authorDate,
      ),
    })
    .from(commitsTable)
    .where(eq(commitsTable.projectId, PROJECT_ID));

/** The same statement without `.mapWith` — the shape that shipped. */
const statementSixUndecoded = (db: ReturnType<typeof dbOver>) =>
  db
    .select({
      at: sql<Date | null>`MAX(${commitsTable.authorDate})`,
      firstAt: sql<Date | null>`MIN(${commitsTable.authorDate})`,
    })
    .from(commitsTable)
    .where(eq(commitsTable.projectId, PROJECT_ID));

describe("drizzle timestamp decoding over neon-http", () => {
  it("returns a Date for a MAX/MIN over a timestamp column", async () => {
    const rows = await statementSix(dbOver([DRIVER_LATEST, DRIVER_EARLIEST]));

    expect(rows[0]?.at).toBeInstanceOf(Date);
    expect(rows[0]?.firstAt).toBeInstanceOf(Date);
    expect((rows[0]?.at as Date).toISOString()).toBe("2026-01-20T00:00:00.000Z");
    expect((rows[0]?.firstAt as Date).toISOString()).toBe(
      "2025-11-02T00:00:00.000Z",
    );
  });

  it("makes the getTime() arithmetic that spanDays performs possible", async () => {
    const rows = await statementSix(dbOver([DRIVER_LATEST, DRIVER_EARLIEST]));
    const at = rows[0]?.at;
    const firstAt = rows[0]?.firstAt;

    // The exact expression `projectService.getProjectInsights` evaluates.
    const days = Math.round(
      ((at as Date).getTime() - (firstAt as Date).getTime()) / 86_400_000,
    );

    expect(days).toBe(79);
  });

  it("does not decode when the fragment has no mapWith — the shipped bug", async () => {
    const rows = await statementSixUndecoded(
      dbOver([DRIVER_LATEST, DRIVER_EARLIEST]),
    );

    // `sql<Date | null>` promised a Date and delivered text. Had the service
    // not called `.getTime()`, this mismatch would have shipped silently into
    // `lastActivityAt` and `lifecycle.firstCommitAt` instead.
    expect(rows[0]?.at).not.toBeInstanceOf(Date);
    expect(typeof rows[0]?.at).toBe("string");
    expect(() => (rows[0]?.at as Date).getTime()).toThrow(TypeError);
  });

  it("decodes a bare column select, so the bug is the fragment and not the driver", async () => {
    const db = dbOver([DRIVER_LATEST]);
    const rows = await db
      .select({ authorDate: commitsTable.authorDate })
      .from(commitsTable)
      .where(eq(commitsTable.projectId, PROJECT_ID))
      .limit(1);

    expect(rows[0]?.authorDate).toBeInstanceOf(Date);
  });

  it("decodes through drizzle's own max()/min() helpers, which attach the decoder for you", async () => {
    const db = dbOver([DRIVER_LATEST, DRIVER_EARLIEST]);
    const rows = await db
      .select({
        at: max(commitsTable.authorDate).mapWith(commitsTable.authorDate),
        firstAt: min(commitsTable.authorDate).mapWith(commitsTable.authorDate),
      })
      .from(commitsTable)
      .where(eq(commitsTable.projectId, PROJECT_ID));

    expect(rows[0]?.at).toBeInstanceOf(Date);
    expect(rows[0]?.firstAt).toBeInstanceOf(Date);
  });

  it("keeps ::date::text aggregates honest as strings", async () => {
    // Statement 1 of the same batch casts to text and is typed `sql<string>`.
    // It is not broken, and it must not be "fixed" into a Date — the day bucket
    // is a calendar label, not an instant.
    const db = dbOver(["2026-01-20"]);
    const rows = await db
      .select({ day: sql<string>`date_trunc('day', ${commitsTable.authorDate})::date::text` })
      .from(commitsTable)
      .where(eq(commitsTable.projectId, PROJECT_ID));

    expect(rows[0]?.day).toBe("2026-01-20");
    expect(rows[0]?.day).not.toBeInstanceOf(Date);
  });

  it("carries an identity decoder until mapWith replaces it", () => {
    // A bare fragment already has a decoder — `noopDecoder`, which returns its
    // input untouched. `mapResultRow` finds that truthy decoder and calls it,
    // so the row is "mapped" and comes back as the same string. The type
    // assertion is what lies, not the driver: nothing ever told drizzle the
    // fragment was a timestamp. `decoder` is a runtime field drizzle keeps off
    // its public types, which is why that assertion is never checked.
    const decoderOf = (fragment: SQL<Date | null>) =>
      (fragment as unknown as { decoder: { mapFromDriverValue(v: unknown): unknown } })
        .decoder;

    const fragment = sql<Date | null>`MAX(${commitsTable.authorDate})`;
    const noop = decoderOf(fragment);

    expect(noop).not.toBe(commitsTable.authorDate);
    expect(noop.mapFromDriverValue(DRIVER_LATEST)).toBe(DRIVER_LATEST);

    fragment.mapWith(commitsTable.authorDate);

    expect(decoderOf(fragment)).toBe(commitsTable.authorDate);
    expect(
      decoderOf(fragment).mapFromDriverValue(DRIVER_LATEST),
    ).toBeInstanceOf(Date);
  });

  it("survives the composed predicate the statement carries in production", async () => {
    // The real call site filters on ownership inside the same `.where`. This
    // guards against the fix accidentally depending on the single-predicate
    // shape used above.
    const db = dbOver([DRIVER_LATEST, DRIVER_EARLIEST]);
    const rows = await db
      .select({
        at: sql<Date | null>`MAX(${commitsTable.authorDate})`.mapWith(
          commitsTable.authorDate,
        ),
        firstAt: sql<Date | null>`MIN(${commitsTable.authorDate})`.mapWith(
          commitsTable.authorDate,
        ),
      })
      .from(commitsTable)
      .where(
        and(
          eq(commitsTable.projectId, PROJECT_ID),
          sql`${commitsTable.authorDate} IS NOT NULL`,
        ),
      );

    expect(rows[0]?.at).toBeInstanceOf(Date);
    expect(rows[0]?.firstAt).toBeInstanceOf(Date);
  });
});