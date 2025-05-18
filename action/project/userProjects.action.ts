"use client";

import axios from "axios";

export interface UserProject {
  id: string;
  projectName: string;
  githubUrl: string;
  star: number;
  forks: number;
  totalCommits: number;
  totalBranches: number;
  totalContributors: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Fetches the user's projects from the API
 * @param userId The ID of the user whose projects to fetch
 */
export const getUserProjects = async (
  userId: string
): Promise<UserProject[]> => {
  if (!userId) {
    throw new Error("User ID is required");
  }

  try {
    const response = await axios.get(
      `/api/project/getUserProject?userId=${userId}`
    );
    const { userProjects } = response.data;

    return userProjects || [];
  } catch (error) {
    console.error("Error fetching user projects:", error);
    throw new Error("Failed to fetch user projects");
  }
};
