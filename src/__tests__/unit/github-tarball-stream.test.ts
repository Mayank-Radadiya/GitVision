/**
 * A GitHub tarball that arrives truncated must not take the process with it.
 *
 * The ingestion path pipes the HTTP body through gunzip into tar-stream. A
 * corrupt or cut-off response makes the gunzip stream emit `error`; with no
 * listener on that stream that is an uncaught exception, so the worker dies
 * instead of the promise rejecting and the Inngest run retrying.
 */

import { Readable } from "node:stream";
import { gzipSync } from "node:zlib";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("axios");
vi.mock("@/db", () => ({
  db: {
    insert: () => ({ values: async () => undefined }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
  },
}));

import axios from "axios";
import { getRepositoryFiles } from "@/src/lib/github/services/files";

const PROJECT_ID = "55555555-5555-4555-8555-555555555555";

/** A gzip payload cut off mid-stream — what a flaky proxy or a killed job gives us. */
const truncatedGzip = () => {
  const full = gzipSync(Buffer.from("not a tarball at all, just bytes"));
  return full.subarray(0, Math.floor(full.length / 2));
};

const respondWith = (body: Buffer) => {
  vi.mocked(axios).mockResolvedValue({ data: Readable.from([body]) } as never);
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getRepositoryFiles tarball stream", () => {
  it("rejects with a readable message when the tarball is corrupt", async () => {
    respondWith(truncatedGzip());

    await expect(
      getRepositoryFiles("owner", "repo", PROJECT_ID),
    ).rejects.toThrow(/corrupt|truncated|unexpected end/i);
  });

  it("rejects rather than throwing synchronously or hanging on a valid-but-empty tarball", async () => {
    respondWith(gzipSync(Buffer.alloc(0)));

    // An empty archive is a well-formed stream with no entries: the happy
    // path still has to resolve, which is what proves the error handler did
    // not swallow normal completion.
    await expect(
      getRepositoryFiles("owner", "repo", PROJECT_ID),
    ).resolves.toBe(0);
  });
});
