/**
 * Hook to manage embedding generation for a project
 * Handles status polling, error handling, and retry logic
 */

import { useState, useEffect, useCallback } from "react";

export type EmbeddingStatus = "pending" | "processing" | "completed" | "failed";

export interface EmbeddingState {
  status: EmbeddingStatus;
  progress: number;
  error: string | null;
  isStarting: boolean;
  isRetrying: boolean;
}

export interface UseEmbeddingManagerReturn extends EmbeddingState {
  startEmbedding: () => Promise<void>;
  retry: () => Promise<void>;
  checkStatus: () => Promise<void>;
}

export function useEmbeddingManager(
  projectId: string,
): UseEmbeddingManagerReturn {
  const [status, setStatus] = useState<EmbeddingStatus>("pending");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  /**
   * Check current embedding status from API
   */
  const checkStatus = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/project/${projectId}/embedding-status`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch embedding status");
      }

      const data = await response.json();
      setStatus(data.status);
      setProgress(data.progress || 0);
      setError(data.error || null);
    } catch (err) {
      console.error("Error checking embedding status:", err);
      setError(err instanceof Error ? err.message : "Failed to check status");
    }
  }, [projectId]);

  /**
   * Start embedding generation
   */
  const startEmbedding = useCallback(async () => {
    setIsStarting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/project/${projectId}/start-embedding`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to start embedding generation");
      }

      const data = await response.json();
      setStatus(data.status);
      setProgress(data.progress || 0);
    } catch (err) {
      console.error("Error starting embedding generation:", err);
      setError(err instanceof Error ? err.message : "Failed to start");
      setStatus("failed");
    } finally {
      setIsStarting(false);
    }
  }, [projectId]);

  /**
   * Retry after failure
   */
  const retry = useCallback(async () => {
    setIsRetrying(true);
    setError(null);
    await startEmbedding();
    setIsRetrying(false);
  }, [startEmbedding]);

  /**
   * Poll for status updates when processing
   */
  useEffect(() => {
    if (status !== "processing") return;

    // Initial check
    checkStatus();

    // Poll every 2 seconds while processing
    const interval = setInterval(checkStatus, 2000);

    return () => clearInterval(interval);
  }, [status, checkStatus]);

  /**
   * Initial status check on mount
   */
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return {
    status,
    progress,
    error,
    isStarting,
    isRetrying,
    startEmbedding,
    retry,
    checkStatus,
  };
}
