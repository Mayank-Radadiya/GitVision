import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const { useUserProjects } = vi.hoisted(() => ({ useUserProjects: vi.fn() }));

vi.mock("@/src/features/dashboard/hooks/use-dashboard", () => ({
  useUserProjects,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import ProjectList from "@/src/features/dashboard/components/project-list/project-list";

describe("ProjectList error state", () => {
  beforeEach(() => {
    useUserProjects.mockReset();
  });

  it("does not tell the user to create a project when the query failed", () => {
    useUserProjects.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("backend down"),
    });

    render(<ProjectList />);

    expect(screen.getByRole("alert")).toHaveTextContent(/couldn.t load your projects/i);
    expect(screen.queryByText(/no projects yet/i)).not.toBeInTheDocument();
  });
});
