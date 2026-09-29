/**
 * The tarball ingestion path had no test at all, and it is the highest-risk
 * code in the repository: one .tar.gz download is gunzipped and tar-parsed
 * straight into the database.
 *
 * The gunzip stream used to be created inline in the pipe chain, with no
 * `error` listener. zlib rejects a payload that is not gzip at the header,
 * before a single byte reaches `extract` — so `extract`'s existing handler
 * never fires, and an `error` on a stream with no listener is an *uncaught
 * exception* in Node. That kills the process instead of rejecting the
 * promise, so the Inngest run never fails and never retries; the ingestion
 * just silently stops.
 *
 * These tests drive the real `getRepositoryFiles` with a mocked axios so the
 * gzip failure actually travels through gunzip → tar → the promise.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Readable } from "node:stream";
import { gzipSync } from "node:zlib";
import * as tar from "tar-stream";

/** What the mocked axios hands back as `response.data`. */
let responseBody: Buffer = Buffer.alloc(0);

vi.mock("axios", () => ({
  default: async () => ({ data: Readable.from([responseBody]) }),
}));

/** Every row handed to `db.insert`, so we can see what was ingested. */
const inserted: Record<string, unknown>[][] = [];

vi.mock("@/db", () => {
  const thenable = (value: unknown) => {
    const b: Record<string, unknown> = {
      then: (r: (v: unknown) => unknown) => Promise.resolve(value).then(r),
    };
    for (const m of ["values", "set", "where", "returning", "onConflictDoNothing"]) {
      b[m] = () => b;
    }
    return b;
  };
  return {
    db: {
      insert: () => {
        const b: Record<string, unknown> = thenable([{ id: "f1" }]);
        b.values = (rows: Record<string, unknown>[]) => {
          inserted.push(rows);
          return b;
        };
        return b;
      },
      update: () => thenable([]),
    },
  };
});

vi.mock("@/src/lib/inngest/client", () => ({
  inngest: { send: async () => {} },
}));

import { getRepositoryFiles } from "@/src/lib/github/services/files";

/** A well-formed .tar.gz containing a single source file. */
function validTarball(): Promise<Buffer> {
  const pack = tar.pack();
  pack.entry({ name: "owner-repo-abc123/src/index.ts", type: "file" }, "export const a = 1;\n");
  pack.finalize();
  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve) => {
    pack.on("data", (c: Buffer) => chunks.push(c));
    pack.on("end", () => resolve(gzipSync(Buffer.concat(chunks))));
  });
}

/** A gzip stream whose deflate body has been overwritten with garbage. */
function corruptDeflate(): Buffer {
  const buf = gzipSync(Buffer.alloc(64 * 1024, 7));
  buf.write("ZZZZZZZZ", 10, 8, "utf8");
  return buf;
}

/** A gzip stream cut off part-way through its compressed body. */
function truncatedTarball(): Buffer {
  const full = gzipSync(Buffer.alloc(64 * 1024, 7));
  return full.subarray(0, Math.floor(full.length / 2));
}

beforeEach(() => {
  inserted.length = 0;
  responseBody = Buffer.alloc(0);
});

describe("tarball ingestion", () => {
  it("rejects a payload that is not gzip instead of throwing an uncaught exception", async () => {
    // A 502 HTML error page from a proxy, served with a 200. zlib rejects the
    // header before a single byte reaches `extract`, so `extract` never
    // errors and its handler cannot save us. Before the fix this was an
    // uncaught exception that killed the process and left the promise
    // unsettled — the Inngest run neither failed nor retried.
    responseBody = Buffer.from("<html>502 Bad Gateway</html>");

    await expect(
      getRepositoryFiles("owner", "repo", "proj_1"),
    ).rejects.toThrow();
  });

  it("names the corruption so the retry log says what happened", async () => {
    responseBody = Buffer.from("<html>502 Bad Gateway</html>");

    await expect(
      getRepositoryFiles("owner", "repo", "proj_1"),
    ).rejects.toThrow(/corrupt tarball/i);
  });

  it("keeps zlib's own reason so the operator is not left guessing", async () => {
    responseBody = Buffer.from("<html>502 Bad Gateway</html>");

    // "incorrect header check" — if the wrapper swallows this, the only
    // thing an operator gets is "something went wrong", which is what the
    // generic catch at the end of the route used to produce.
    await expect(
      getRepositoryFiles("owner", "repo", "proj_1"),
    ).rejects.toThrow(/incorrect header check/i);
  });

  it("rejects a gzip body with a corrupt deflate stream", async () => {
    responseBody = corruptDeflate();

    await expect(
      getRepositoryFiles("owner", "repo", "proj_1"),
    ).rejects.toThrow(/corrupt tarball/i);
  });

  it("rejects a truncated tarball", async () => {
    // Truncation surfaces as a tar-level failure instead: gunzip still
    // manages to emit the blocks it decoded, so `extract` sees a bad header
    // and fails first. That path already worked, and the tar-stream error is
    // kept verbatim in `details.originalError` by the pre-existing generic
    // catch. This pins the behaviour so handling the gunzip error did not
    // quietly change what truncation reports.
    responseBody = truncatedTarball();

    const err = await getRepositoryFiles("owner", "repo", "proj_1").then(
      () => null,
      (e: unknown) => e as Error & { details?: Record<string, unknown> },
    );

    expect(err?.details?.originalError).toMatch(/invalid tar header/i);
  });

  it("still ingests a valid tarball", async () => {
    responseBody = await validTarball();

    await expect(
      getRepositoryFiles("owner", "repo", "proj_1"),
    ).resolves.toBe(1);

    expect(inserted.flat()).toEqual([
      expect.objectContaining({ fileName: "src/index.ts" }),
    ]);
  });
});
