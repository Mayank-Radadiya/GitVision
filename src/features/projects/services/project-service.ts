// Services for fetching project data

import axios from "axios";
import { ProjectDetails, CommitData } from "../types";

/**
 * Fetch project details
 */
export const fetchProjectDetails = async (
  projectId: string,
  signal?: AbortSignal
): Promise<ProjectDetails> => {
  console.log("Fetching project details for ID:", projectId);
  
  const res = await axios.get(
    `/api/project/getProjectDetails?projectId=${projectId}`,
    { signal }
  );

  if (!res.data.project) {
    throw new Error("Project not found");
  }

  return res.data.project as ProjectDetails;
};

/**
 * Fetch project commits
 */
export const fetchProjectCommits = async (
  projectId: string,
  page = 1,
  limit = 10,
  signal?: AbortSignal
): Promise<CommitData> => {
  const res = await axios.get(
    `/api/project/getProjectCommits?projectId=${projectId}&limit=${limit}&page=${page}`,
    { signal }
  );

  return {
    commits: res.data.commits,
    pagination: {
      totalPages: res.data.pagination.totalPages,
      total: res.data.pagination.total,
    },
  } as CommitData;
};
