/**
 * =============================================================================
 * F-01 — Deep link `?url=` on the create-project form
 * =============================================================================
 *
 * The landing hero used to push `/create-project?url=<encoded>` while nothing
 * read the parameter, so a pasted repository URL was silently dropped on the
 * floor. These tests pin the repaired contract:
 *
 *   1. `?url=` decodes and pre-fills `repoUrl`
 *   2. no parameter leaves the field empty
 *   3. preset selection still populates both fields
 *   4. arriving with `?url=` never creates a project (no credit spend)
 *   5. re-rendering with an unchanged parameter does not clobber manual edits
 *
 * `useSearchParams` and the two data hooks are mocked so the test exercises the
 * real form wiring without a router, a tRPC client, or the database.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CreateNewProjectForm from "@/features/projects/components/create-project/add-repo";

const h = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
  mutate: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => h.searchParams,
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/features/projects/hooks/use-create-project", () => ({
  useCreateProject: () => ({
    mutate: h.mutate,
    isPending: false,
    isSuccess: false,
  }),
}));

vi.mock("@/features/dashboard/hooks/use-dashboard", () => ({
  useCredits: () => ({ data: 50 }),
}));

const REPO_URL = "https://github.com/vercel/next.js";

/**
 * Mirrors what the hero produces on the wire: the raw query string carries a
 * percent-encoded URL (`?url=https%3A%2F%2Fgithub.com%2Fvercel%2Fnext.js`).
 * `URLSearchParams.get()` performs that single decode for us, so the value must
 * be handed over unencoded here or it would be decoded twice.
 */
function withUrlParam(url: string | null) {
  h.searchParams = new URLSearchParams(
    url === null ? "" : `url=${encodeURIComponent(url)}`,
  );
}

function renderForm() {
  return render(<CreateNewProjectForm />);
}

function repoInput() {
  return screen.getByLabelText("GitHub Repository URL");
}

beforeEach(() => {
  h.mutate.mockClear();
  h.searchParams = new URLSearchParams();
});

describe("F-01 — create-project ?url= deep link", () => {
  it("1. decodes ?url= and pre-fills the repoUrl field", () => {
    withUrlParam(REPO_URL);

    renderForm();

    expect(repoInput()).toHaveValue(REPO_URL);
  });

  it("2. leaves repoUrl empty when the parameter is absent or blank", () => {
    const withoutParam = renderForm();
    expect(repoInput()).toHaveValue("");
    withoutParam.unmount();

    withUrlParam("   ");
    renderForm();
    expect(repoInput()).toHaveValue("");
  });

  it("3. preset selection still populates repoUrl and projectName", () => {
    renderForm();

    fireEvent.click(screen.getByText("facebook/react"));

    expect(repoInput()).toHaveValue("https://github.com/facebook/react");
    expect(screen.getByLabelText("Project Name")).toHaveValue("React");
  });

  it("4. never creates a project on mount, so no credits are spent", () => {
    withUrlParam(REPO_URL);

    renderForm();

    expect(repoInput()).toHaveValue(REPO_URL);
    expect(h.mutate).not.toHaveBeenCalled();
  });

  it("5. an identical parameter does not overwrite a manual edit", () => {
    withUrlParam(REPO_URL);

    const { rerender } = renderForm();
    fireEvent.change(repoInput(), {
      target: { value: "https://github.com/owner/edited" },
    });
    expect(repoInput()).toHaveValue("https://github.com/owner/edited");

    // Same query string, new render: the effect must not re-run the reset.
    rerender(<CreateNewProjectForm />);
    expect(repoInput()).toHaveValue("https://github.com/owner/edited");
  });
});
