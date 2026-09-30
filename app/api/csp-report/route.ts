import { NextResponse } from "next/server";
import { logger } from "@/src/lib/logger";

/**
 * CSP violation collector for the report-only phase (M19, decision D-5).
 *
 * Browsers post here on their own — no user session, no CSRF token — because
 * the whole point is to catch the moment a page tried to load something the
 * policy does not name. That makes this an unauthenticated write endpoint, so
 * it is deliberately boring: it reads a bounded body, writes a line to the
 * log, and returns nothing. A violation report already contains attacker-
 * chosen strings, so nothing from the body is ever echoed back.
 *
 * The header is now `Content-Security-Policy` — enforcing, not report-only —
 * and this collector still receives reports. A blocked script produces a report
 * too, which is exactly the signal you want: it says the browser refused to run
 * something, not merely that it was allowed to try.
 */
export const dynamic = "force-dynamic";

/**
 * A real `csp-report` is a few hundred bytes. 16 KB leaves room for the
 * Reporting API's batch envelope and still refuses a body big enough to turn
 * an unauthenticated POST into a log-flooding or memory-exhaustion vector.
 */
const MAX_REPORT_BYTES = 16 * 1024;

type Violation = {
  documentUri?: string;
  blockedUri?: string;
  directive?: string;
  sourceFile?: string;
  lineNumber?: number;
};

const truncate = (value: string | undefined) =>
  value === undefined ? undefined : value.slice(0, 512);

/** Legacy body: `{ "csp-report": { ... } }`. */
function readLegacyReport(body: Record<string, unknown>): Violation[] {
  const report = body["csp-report"] as Record<string, unknown> | undefined;
  if (!report) return [];
  return [
    {
      documentUri: truncate(report["document-uri"] as string | undefined),
      blockedUri: truncate(report["blocked-uri"] as string | undefined),
      directive: truncate(report["violated-directive"] as string | undefined),
      sourceFile: truncate(report["source-file"] as string | undefined),
    },
  ];
}

/** Reporting API body: an array of `{ type: "csp-violation", body: {...} }`. */
function readReportsApi(body: unknown): Violation[] {
  if (!Array.isArray(body)) return [];
  return body.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const record = entry as Record<string, unknown>;
    if (record.type !== "csp-violation") return [];
    const violation = (record.body ?? {}) as Record<string, unknown>;
    return [
      {
        documentUri: truncate(violation.documentURL as string | undefined),
        blockedUri: truncate(violation.blockedURL as string | undefined),
        directive: truncate(violation.effectiveDirective as string | undefined),
        sourceFile: truncate(violation.sourceFile as string | undefined),
        lineNumber: violation.lineNumber as number | undefined,
      },
    ];
  });
}

export async function POST(request: Request) {
  const raw = await request.text();

  // Over budget, or not JSON at all. Either way the caller gets the same
  // answer: a browser only needs a 2xx to stop retrying the report.
  if (raw.length > MAX_REPORT_BYTES) {
    logger.warn(
      `[CSP] Dropped an oversized violation report (${raw.length} bytes, limit ${MAX_REPORT_BYTES})`,
    );
    return new NextResponse(null, { status: 204 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    logger.warn("[CSP] Dropped a violation report that was not valid JSON");
    return new NextResponse(null, { status: 204 });
  }

  const violations = [
    ...readLegacyReport((parsed ?? {}) as Record<string, unknown>),
    ...readReportsApi(parsed),
  ];

  for (const violation of violations) {
    logger.warn(
      `[CSP] Violation: ${violation.directive ?? "unknown directive"} blocked ${violation.blockedUri ?? "unknown source"}`,
      {
        documentUri: violation.documentUri,
        blockedUri: violation.blockedUri,
        directive: violation.directive,
        sourceFile: violation.sourceFile,
        lineNumber: violation.lineNumber,
      },
    );
  }

  if (violations.length === 0) {
    logger.warn("[CSP] Dropped a violation report with no recognisable violation");
  }

  return new NextResponse(null, { status: 204 });
}
