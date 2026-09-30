/**
 * settings-page.test.tsx
 *
 * The delete path is the only irreversible thing in the app, so it gets the
 * only new tests. Two layers are pinned:
 *
 *   1. The server schemas. `deleteAccountInput` is a `z.literal`, so a
 *      near-miss — different case, stray space, plural — is rejected during
 *      input parsing, before any Clerk call. The theme enum is pinned for the
 *      same reason: the column has no SQL check, so the enum is the only gate.
 *
 *   2. The dialog's arm gate. The button stays disabled until the field equals
 *      the phrase exactly. This is cosmetic — the server is authoritative — but
 *      it is the last thing between a misclick and an irreversible delete.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

// ── server fakes: the schemas under test are pure, but importing the router
//    pulls the db and Clerk clients in behind them ────────────────────────────

vi.mock("@/db", () => ({
  db: {
    select: () => {
      const builder: Record<string, unknown> = { then: () => builder };
      for (const m of ["from", "where", "limit", "update", "set", "delete"]) {
        builder[m] = () => builder;
      }
      return builder;
    },
  },
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(async () => ({ userId: "user_1", sessionId: "sess_1" })),
  clerkClient: vi.fn(async () => ({
    sessions: { revokeSession: vi.fn() },
    users: { deleteUser: vi.fn() },
  })),
}));

const deleted: unknown[] = [];

vi.mock("@/src/lib/trpc/client", () => ({
  trpc: {
    user: {
      deleteAccount: {
        useMutation: () => ({
          mutate: (input: unknown) => deleted.push(input),
          isPending: false,
        }),
      },
    },
  },
}));

const pushed: string[] = [];

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: (href: string) => pushed.push(href), refresh: vi.fn() }),
}));

vi.mock("react-hot-toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
  Toaster: () => null,
}));

import {
  DELETE_CONFIRMATION,
  deleteAccountInput,
  themePreferenceInput,
} from "@/src/features/user/server/router/user";
import DangerZoneSection from "@/src/features/user/components/settings/DangerZoneSection";

beforeEach(() => {
  deleted.length = 0;
  pushed.length = 0;
});

describe("deleteAccountInput", () => {
  it("accepts the exact phrase", () => {
    expect(
      deleteAccountInput.parse({ confirmation: DELETE_CONFIRMATION }),
    ).toEqual({ confirmation: "delete my account" });
  });

  it.each([
    ["trailing space", "delete my account "],
    ["leading space", " delete my account"],
    ["capitalised", "Delete my account"],
    ["uppercased", "DELETE MY ACCOUNT"],
    ["plural", "delete my accounts"],
    ["truncated", "delete my"],
    ["empty", ""],
    ["a different destructive phrase", "delete everything"],
  ])("rejects a near-miss: %s", (_label, confirmation) => {
    expect(deleteAccountInput.safeParse({ confirmation }).success).toBe(false);
  });

  it("rejects a missing confirmation outright", () => {
    expect(deleteAccountInput.safeParse({}).success).toBe(false);
  });
});

describe("themePreferenceInput", () => {
  it.each(["light", "dark", "system"])("accepts %s", (theme) => {
    expect(themePreferenceInput.parse(theme)).toBe(theme);
  });

  it.each(["", "blue", "Dark", "DARK", "auto", null, 1])(
    "rejects %j",
    (theme) => {
      expect(themePreferenceInput.safeParse(theme).success).toBe(false);
    },
  );
});

describe("DangerZoneSection confirmation gate", () => {
  const openDialog = () => {
    render(<DangerZoneSection />);
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
  };

  const confirmButton = () =>
    screen.getByRole("button", { name: "Delete permanently" });

  it("keeps the destructive action disabled with an empty field", () => {
    openDialog();

    expect(confirmButton()).toBeDisabled();
    expect(deleted).toHaveLength(0);
  });

  it("stays disabled for a near-miss, and nothing is deleted", () => {
    openDialog();
    fireEvent.change(screen.getByLabelText("Confirmation"), {
      target: { value: "Delete my account" },
    });

    expect(confirmButton()).toBeDisabled();
    expect(deleted).toHaveLength(0);
  });

  it("arms only on the exact phrase, and then sends it", () => {
    openDialog();
    const field = screen.getByLabelText("Confirmation");

    fireEvent.change(field, { target: { value: "delete my " } });
    expect(confirmButton()).toBeDisabled();

    fireEvent.change(field, { target: { value: "delete my account" } });
    expect(confirmButton()).toBeEnabled();

    fireEvent.click(confirmButton());
    expect(deleted).toEqual([{ confirmation: "delete my account" }]);
  });
});
