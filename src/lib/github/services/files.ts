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
 * streams them directly into the database with O(1) memory usage.
 *
 * ── HOW IT WORKS ──
 *  1. Downloads the repo as .tar.gz in 1 API call
 *  2. Pipes through gunzip → tar-stream extractor
 *  3. For each file entry, accumulates into a small batch
 *  4. When batch is full → flush to DB → clear batch → continue
 *  5. Memory never exceeds (FILE_BATCH_SIZE × avg file size)
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

    // ── Stream directly into DB (O(1) memory) ──
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

    throw new GitHubError(
      "Failed to fetch repository files",
      "FILE_FETCH_ERROR",
      500,
      { originalError: error instanceof Error ? error.message : String(error) },
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

    extract.on("entry", (header, entryStream, next) => {
      const cleanPath = header.name.split("/").slice(1).join("/");

      // Skip directories, empty paths, and ignored patterns immediately
      if (header.type !== "file" || !cleanPath || isIgnoredPath(cleanPath)) {
        entryStream.resume();
        return next();
      }

      const chunks: Buffer[] = [];
      entryStream.on("data", (chunk: Buffer) => chunks.push(chunk));
      entryStream.on("end", async () => {
        const content = Buffer.concat(chunks).toString("utf-8");

        // Skip binary files
        if (!content.includes("\0")) {
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
        resolve(totalStored);
      } catch (err) {
        reject(err);
      }
    });

    extract.on("error", reject);

    stream.pipe(createGunzip()).pipe(extract);
  });
}
