/**
 * The project error screen has to tell a dead project from a dropped
 * connection.
 *
 * It received only `message`, so "Project not found" and "Failed to fetch" both
 * rendered the same card with the same "Try again" button — a button whose one
 * guaranteed outcome was another four requests (one attempt plus three retries)
 * at a resource the server had already said does not exist. `NOT_FOUND` is the
 * one tRPC code the server can reach here that is permanent by construction:
 * `assertProjectOwnership` answers it for a row that is gone *and* for a row
 * belonging to someone else, and neither state changes on a retry.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push }),
}));

import ProjectError from "@/features/projects/components/project-view/project-error";

beforeEach(() => vi.clearAllMocks());

describe("ProjectError with a NOT_FOUND code", () => {
  it("says the project is gone instead of blaming the network", () => {
    render(
      <ProjectError code="NOT_FOUND" message="Project not found" onRetry={() => {}} />,
    );
    expect(
      screen.getByText(/couldn.t find this project/i),
    ).toBeInTheDocument();
  });

  it("offers no retry, because the answer cannot change", () => {
    render(
      <ProjectError code="NOT_FOUND" message="Project not found" onRetry={() => {}} />,
    );
    expect(screen.queryByRole("button", { name: /try again/i })).toBeNull();
  });

  it("still offers the way out", () => {
    render(
      <ProjectError code="NOT_FOUND" message="Project not found" onRetry={() => {}} />,
    );
    expect(screen.getAllByRole("button", { name: /dashboard|projects/i })).not
      .toHaveLength(0);
  });
});

describe("ProjectError with a transient failure", () => {
  it("keeps the retry affordance", () => {
    const onRetry = vi.fn();
    render(
      <ProjectError code="INTERNAL_SERVER_ERROR" message="Boom" onRetry={onRetry} />,
    );
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("keeps the generic heading, because the cause is unknown", () => {
    render(
      <ProjectError code="INTERNAL_SERVER_ERROR" message="Boom" onRetry={() => {}} />,
    );
    expect(screen.getByText(/couldn.t load this project/i)).toBeInTheDocument();
  });
});

describe("ProjectError with no code", () => {
  it("defaults to the retryable presentation rather than assuming permanence", () => {
    render(<ProjectError message="Boom" onRetry={() => {}} />);
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByText(/couldn.t load this project/i)).toBeInTheDocument();
  });
});
