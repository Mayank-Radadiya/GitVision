"use server";

// ============================================================================
// GitHub Service — Incremental Re-sync (F-14)
// ============================================================================
// Re-streams a repository tarball and reconciles `project_files` against it by
// content hash, so an unchanged file is never rewritten and never re-embedded.
//
// The rules that make this safe rather than merely clever:
//
//  1. UPSERT, never insert. `project_files_project_id_file_name_unique` means a
//     blind re-insert of a path already stored aborts the whole batch. Upserting
//     on (projectId, fileName) also keeps the row `id` stable, which
//     `codeEmbeddings.fileId` depends on — a delete-then-insert would orphan
//     every embedding that referenced the old id.
//
//  2. NEVER delete first. The tarball is fully diffed in memory before a single
//     row is written, so a GitHub failure part-way through leaves the project's
//     existing files exactly as they were. Same reasoning as the issues sync
//     (T-045): a sync must never be able to empty a project.
//
//  3. NEVER prune a partial view. Ignored paths, oversized files and binaries
//     are absent from the tarball pass by design, and the run stops dead at
//     MAX_FILES_PER_REPO. "Not in this list" only means "deleted from the
//     repository" when the run actually saw the whole repository. When it did
//     not, pruning would delete every filtered-out file in the project.

import { db } from "@/db";
import { projectFiles } from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import * as tar from "tar-stream";
import { createGunzip } from "zlib";
import { computeHash } from "@/src/features/rag/services/code-chunker";
import { GITHUB_CONFIG } from "../constants";
import { GitHubError, GitHubValidationError, GitHubAPIError } from "../errors";
import { fetchRepoTarballStream } from "../client";
import { isIgnoredPath } from "../utils";
import { logger } from "@/src/lib/logger";

export interface ResyncResult {
  /** Ids of files that were added or whose content changed. Needs re-embedding. */
  changedFileIds: string[];
  /** Paths that did not exist in the database before this run. */
  added: number;
  /** Paths whose hash differed from the stored hash. */
  modified: number;
  /** Rows deleted because GitHub no longer has the path. Always 0 if truncated. */
  removed: number;
  /** The pull hit a cap or dropped hostile paths, so the view is not complete. */
  truncated: boolean;
  /** Files observed in the tarball, which is what `projects.totalFiles` becomes. */
  totalSeen: number;
  /** Unchanged files that were neither written nor embedded. */
  unchanged: number;
}

/**
 * Re-streams the repository tarball and reconciles stored files against it.
 *
 * One GitHub API call, same as the initial import. The cost that makes this
 * worth doing incrementally is downstream: an unchanged file costs a SHA-256
 * and nothing else, where re-running the full embedding pipeline would re-chunk
 * and re-embed it.
 */
export async function resyncRepositoryFiles(
  owner: string,
  repo: string,
  projectId: string,
): Promise<ResyncResult> {
  if (!owner || !repo || !projectId) {
    throw new GitHubValidationError(
      "Owner, repo, and projectId are required",
      { owner, repo, projectId },
    );
  }

  logger.info("Re-syncing repository files via tarball (hash diff)", {
    owner,
    repo,
    projectId,
  });

  // One query for the whole existing set, not one per file. The map is
  // path -> row so the diff in the stream handler is a lookup, not a scan.
  const existing = await db
    .select({ id: projectFiles.id, fileName: projectFiles.fileName, hash: projectFiles.hash })
    .from(projectFiles)
    .where(eq(projectFiles.projectId, projectId));

  const known = new Map(existing.map((row) => [row.fileName, row]));

  const response = await fetchRepoTarballStream(owner, repo);
  const outcome = await diffTarball(response.data, projectId, known);

  const {
    upserts,
    changedPaths,
    seen,
    truncated,
    totalSeen,
    unsafePathCount,
    firstUnsafePath,
    skippedCount,
  } = outcome;

  // ── Phase 2: write. Nothing above this line touched the database. ──
  if (upserts.length > 0) {
    await db
      .insert(projectFiles)
      .values(upserts)
      .onConflictDoUpdate({
        target: [projectFiles.projectId, projectFiles.fileName],
        set: {
          code: sql`excluded.code`,
          hash: sql`excluded.hash`,
          updatedAt: new Date(),
        },
      });
  }

  // Resolve the changed paths back to ids. For pre-existing rows the id was
  // already known; only genuinely new files need a lookup, and one query for
  // all of them beats a query per file.
  const knownChanged = new Map(
    changedPaths
      .filter((path) => known.has(path))
      .map((path) => [path, known.get(path)!.id]),
  );
  const newPaths = changedPaths.filter((path) => !known.has(path));
  let changedFileIds = [...knownChanged.values()];

  if (newPaths.length > 0) {
    const inserted = await db
      .select({ id: projectFiles.id, fileName: projectFiles.fileName })
      .from(projectFiles)
      .where(
        and(
          eq(projectFiles.projectId, projectId),
          inArray(projectFiles.fileName, newPaths),
        ),
      );
    for (const row of inserted) {
      knownChanged.set(row.fileName, row.id);
    }
    changedFileIds = [...knownChanged.values()];
  }

  // ── Prune: only when the run saw the whole repository. ──
  let removed = 0;
  if (!truncated) {
    const missing = existing
      .filter((row) => !seen.has(row.fileName))
      .map((row) => row.fileName);

    if (missing.length > 0) {
      // Embeddings go with them: `code_embeddings.file_id` cascades.
      await db
        .delete(projectFiles)
        .where(
          and(
            eq(projectFiles.projectId, projectId),
            inArray(projectFiles.fileName, missing),
          ),
        );
      removed = missing.length;
    }
  } else {
    logger.warn(
      "Skipping prune: tarball pass was incomplete, so absence is not deletion",
      { projectId, totalSeen, unsafePathCount },
    );
  }

  if (unsafePathCount > 0) {
    logger.error(
      `Dropped ${unsafePathCount} tar entries whose path escaped the repo`,
      { projectId, totalSeen, firstUnsafePath },
    );
  }
  if (skippedCount > 0) {
    logger.warn(
      `Skipped ${skippedCount} entries over ${GITHUB_CONFIG.MAX_FILE_BYTES} bytes`,
      { projectId, totalSeen },
    );
  }

  const result: ResyncResult = {
    changedFileIds,
    added: newPaths.length,
    modified: changedPaths.length - newPaths.length,
    removed,
    truncated,
    totalSeen,
    unchanged: totalSeen - changedPaths.length,
  };

  logger.info("Re-sync diff complete", {
    projectId,
    ...result,
    changedFileIds: changedFileIds.length,
  });

  return result;
}

/** `sql.raw` is not needed for values, but the excluded pseudo-table is. */
interface DiffState {
  upserts: {
    fileName: string;
    code: string;
    projectId: string;
    hash: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
  changedPaths: string[];
  seen: Set<string>;
  truncated: boolean;
  totalSeen: number;
  unsafePathCount: number;
  firstUnsafePath: string | null;
  skippedCount: number;
}

/**
 * Streams the tarball, comparing each entry's hash against `known` and
 * accumulating upserts for the ones that differ. Pure read of the stream — the
 * caller does the writing, so a rejected stream leaves the database untouched.
 */
function diffTarball(
  stream: NodeJS.ReadableStream,
  projectId: string,
  known: Map<string, { id: string; hash: string | null }>,
): Promise<DiffState> {
  return new Promise((resolve, reject) => {
    const extract = tar.extract();
    const state: DiffState = {
      upserts: [],
      changedPaths: [],
      seen: new Set(),
      truncated: false,
      totalSeen: 0,
      unsafePathCount: 0,
      firstUnsafePath: null,
      skippedCount: 0,
    };

    extract.on("entry", (header, entryStream, next) => {
      // Same traversal defence as the initial import (T-016): a `..` surviving
      // into `fileName` is attacker-controlled text from a hostile repository
      // that ends up persisted, rendered in the file tree, and cited back to
      // the model. A dropped entry also means this run saw an incomplete view,
      // which is what disables the prune below.
      const cleanPath = header.name.split("/").slice(1).join("/");
      if (cleanPath.split("/").includes("..")) {
        state.unsafePathCount++;
        state.firstUnsafePath ??= header.name;
        state.truncated = true;
        entryStream.resume();
        return next();
      }

      if (header.type !== "file" || !cleanPath || isIgnoredPath(cleanPath)) {
        entryStream.resume();
        return next();
      }

      if (state.totalSeen >= GITHUB_CONFIG.MAX_FILES_PER_REPO) {
        // The repository is larger than we ingest. Everything past this point
        // is unseen, so absence proves nothing and the prune must not run.
        state.truncated = true;
        entryStream.resume();
        return next();
      }

      if ((header.size ?? 0) > GITHUB_CONFIG.MAX_FILE_BYTES) {
        state.skippedCount++;
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
          state.skippedCount++;
        } else {
          chunks.push(chunk);
        }
      });

      entryStream.on("end", () => {
        if (overflowed) return next();

        const content = Buffer.concat(chunks).toString("utf-8");
        // Binary content is skipped here exactly as at import, so it never
        // reaches `seen` — and therefore never causes a prune of a row that a
        // previous run stored. A repo that gains a binary where text used to be
        // keeps its old row; the stale text is a far smaller problem than
        // deleting files on an incomplete view.
        if (content.includes("\0")) return next();

        state.totalSeen++;
        state.seen.add(cleanPath);

        const hash = computeHash(content);
        const previous = known.get(cleanPath);
        // The whole point: an unchanged file is neither written nor re-embedded.
        if (previous && previous.hash === hash) return next();

        state.changedPaths.push(cleanPath);
        state.upserts.push({
          fileName: cleanPath,
          code: content,
          projectId,
          hash,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        // Bound the buffer the same way the importer does. Beyond this the
        // remaining diffs would all be guesses anyway, and the flag keeps the
        // prune off.
        if (state.upserts.length >= GITHUB_CONFIG.MAX_FILES_PER_REPO) {
          state.truncated = true;
        }

        next();
      });
    });

    extract.on("finish", () => resolve(state));
    extract.on("error", reject);

    const gunzip = createGunzip();
    gunzip.on("error", (err) =>
      reject(
        new GitHubAPIError(
          `Corrupt tarball response: gzip stream failed — ${
            err instanceof Error ? err.message : String(err)
          }`,
          502,
        ),
      ),
    );

    stream.pipe(gunzip).pipe(extract);
  });
}
