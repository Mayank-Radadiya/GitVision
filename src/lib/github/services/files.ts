"use server";

// ============================================================================
// GitHub Service — File Fetching (Tarball)
// ============================================================================
// Downloads the entire repo in 1 API call as a .tar.gz, then streams
// files directly into the database (O(1) memory — no OOM risk).

import { db } from "@/db";
import { projectFiles, projectTables } from "@/db/schema";
import { eq } from "drizzle-orm";
import axios from "axios";
import * as tar from "tar-stream";
import { createGunzip } from "zlib";
import { computeHash } from "@/src/features/rag/services/code-chunker";
import { GITHUB_CONFIG } from "../constants";
import { GitHubError, GitHubValidationError, GitHubAPIError } from "../errors";
import { isIgnoredPath, log } from "../utils";

/**
 * Fetches ALL repository files via a single tarball download and
 * streams them directly into the database with bounded memory usage.
 *
 * ── HOW IT WORKS ──
 *  1. Downloads the repo as .tar.gz in 1 API call
 *  2. Pipes through gunzip → tar-stream extractor
 *  3. For each file entry, accumulates into a small batch
 *  4. When batch is full → flush to DB → clear batch → continue
 *  5. Memory is bounded by (FILE_BATCH_SIZE × MAX_FILE_BYTES): entries over
 *     MAX_FILE_BYTES are dropped mid-stream rather than buffered whole, and
 *     ingestion stops after MAX_FILES_PER_REPO entries
 *
 * @param owner - GitHub repository owner
 * @param repo - GitHub repository name
 * @param projectId - UUID of the project
 * @returns Total number of files stored
 */
export async function getRepositoryFiles(
  owner: string,
  repo: string,
  projectId: string,
): Promise<number> {
  try {
    if (!owner || !repo || !projectId) {
      throw new GitHubValidationError(
        "Owner, repo, and projectId are required",
        { owner, repo, projectId },
      );
    }

    log("info", "Fetching repository files via tarball (stream-to-DB)", {
      owner,
      repo,
      projectId,
    });

    // ── 1 API call: stream the entire repo as .tar.gz ──
    const response = await axios({
      method: "get",
      url: `https://api.github.com/repos/${owner}/${repo}/tarball`,
      responseType: "stream",
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
      },
      timeout: 120000, // 2-minute timeout for large repos
    });

    // ── Stream directly into DB (bounded memory) ──
    const totalStored = await streamAndStoreTarball(response.data, projectId);

    // ── Persist the final file count to the project row ──
    // This avoids a SELECT COUNT(*) on every dashboard load (N+1 fix).
    await db
      .update(projectTables)
      .set({ totalFiles: totalStored })
      .where(eq(projectTables.id, projectId));

    log("info", `Stored ${totalStored} files from tarball`, {
      owner,
      repo,
      projectId,
    });

    return totalStored;
  } catch (error) {
    if (
      error instanceof GitHubValidationError ||
      error instanceof GitHubAPIError
    ) {
      throw error;
    }

    log("error", "Error fetching repository files", {
      owner,
      repo,
      projectId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    // Carry the underlying reason in the message: this error is what lands in
    // the Inngest retry log, and "Failed to fetch repository files" on its own
    // tells an operator nothing about which stage broke.
    const reason = error instanceof Error ? error.message : String(error);

    throw new GitHubError(
      `Failed to fetch repository files: ${reason}`,
      "FILE_FETCH_ERROR",
      500,
      { originalError: reason },
    );
  }
}

/**
 * Pipe a raw .tar.gz stream through gunzip + tar-stream and insert
 * files into the database in batches (backpressure pattern).
 *
 * Tarball paths: `owner-repo-sha/src/index.ts` → strip first segment.
 * Skips directories, ignored paths, and binary files (null-byte check).
 *
 * @param stream - Readable stream of .tar.gz response body
 * @param projectId - UUID of the project
 * @returns Total number of files stored
 */
async function streamAndStoreTarball(
  stream: NodeJS.ReadableStream,
  projectId: string,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const extract = tar.extract();

    // Small batch buffer — flushed every FILE_BATCH_SIZE entries
    let batch: {
      fileName: string;
      code: string;
      projectId: string;
      hash: string;
      createdAt: Date;
      updatedAt: Date;
    }[] = [];
    let totalStored = 0;
    let storedCount = 0;
    let skippedCount = 0;

    extract.on("entry", (header, entryStream, next) => {
      const cleanPath = header.name.split("/").slice(1).join("/");

      // Skip directories, empty paths, and ignored patterns immediately
      if (header.type !== "file" || !cleanPath || isIgnoredPath(cleanPath)) {
        entryStream.resume();
        return next();
      }

      // Per-file guard. The entry is buffered in full before it can be
      // hashed, so the byte cap is what bounds peak memory here; once it is
      // exceeded we stop accumulating and drop the entry.
      if (storedCount >= GITHUB_CONFIG.MAX_FILES_PER_REPO) {
        entryStream.resume();
        return next();
      }
      if ((header.size ?? 0) > GITHUB_CONFIG.MAX_FILE_BYTES) {
        skippedCount++;
        entryStream.resume();
        return next();
      }

      const chunks: Buffer[] = [];
      let size = 0;
      let overflowed = false;
      entryStream.on("data", (chunk: Buffer) => {
        if (overflowed) return;
        size += chunk.length;
        if (size > GITHUB_CONFIG.MAX_FILE_BYTES) {
          overflowed = true;
          chunks.length = 0;
          skippedCount++;
          return;
        }
        chunks.push(chunk);
      });
      entryStream.on("end", async () => {
        if (overflowed) return next();
        const content = Buffer.concat(chunks).toString("utf-8");

        // Skip binary files
        if (!content.includes("\0")) {
          storedCount++;
          batch.push({
            fileName: cleanPath,
            code: content,
            projectId,
            hash: computeHash(content),
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }

        // ── BACKPRESSURE: flush to DB when batch full ──
        if (batch.length >= GITHUB_CONFIG.FILE_BATCH_SIZE) {
          try {
            await db.insert(projectFiles).values(batch);
            totalStored += batch.length;
            log("info", `Flushed ${batch.length} files to DB`, {
              totalStored,
            });
            batch = [];
          } catch (err) {
            return reject(err);
          }
        }

        next();
      });
    });

    extract.on("finish", async () => {
      try {
        if (batch.length > 0) {
          await db.insert(projectFiles).values(batch);
          totalStored += batch.length;
        }
        if (skippedCount > 0) {
          log(
            "warn",
            `Skipped ${skippedCount} entries over ${GITHUB_CONFIG.MAX_FILE_BYTES} bytes`,
            { projectId, totalStored },
          );
        }
        resolve(totalStored);
      } catch (err) {
        reject(err);
      }
    });

    extract.on("error", reject);

    // The gunzip stage is its own stream and needs its own handler. Without
    // one, a truncated or corrupt .tar.gz emits `error` on a listener-less
    // stream, which is an uncaught exception: the process dies instead of the
    // promise rejecting and the Inngest run retrying.
    const gunzip = createGunzip();
    gunzip.on("error", (err) =>
      reject(
        new Error(
          `Corrupt or truncated GitHub tarball: gunzip failed (${err.message})`,
        ),
      ),
    );
    stream.pipe(gunzip).pipe(extract);
  });
}
