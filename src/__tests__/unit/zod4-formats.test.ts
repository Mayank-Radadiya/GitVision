/**
 * T53 — the Zod 4 migration guard.
 *
 * `z.string().email()`, `z.string().url()` and `z.string().uuid()` are the Zod 3
 * chain forms. Zod 4 deprecated them in favour of the top-level `z.email()`,
 * `z.url()` and `z.uuid()`. The migration is mechanical and the point of the
 * task is that the diff is provably behaviour-free, so the risk is not the swap
 * — it is someone writing the chain form again in a new file six months from
 * now, in a codebase that no longer warns about it.
 *
 * This walks `src/` and fails on any surviving chain form, so the deprecation
 * cannot come back. The behaviour guarantees (custom messages intact, valid
 * values still accepted) are pinned below rather than assumed from the fact
 * that the refactor compiled.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

/** Every `.ts`/`.tsx` file under `src/`, tests included so this file is scanned. */
function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(entry.name)) found.push(path);
  }
  return found;
}

const SRC = join(process.cwd(), "src");
const CHAIN_FORM = /z\.string\(\)\.(email|url|uuid)\b/;

describe("Zod 4 top-level string formats", () => {
  // The title names the rule in words rather than by writing the chain form out:
  // a line-scan guard reads its own file too, and the one place the deprecated
  // spelling has to appear is the regex below.
  it("leaves no deprecated Zod 3 string-format chains in src/", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      // A line inside a comment is documentation, not a call site; leaving the
      // form in prose is fine and stripping comments would renumber the lines
      // this test reports.
      let inBlockComment = false;
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          const trimmed = line.trimStart();
          if (inBlockComment) {
            if (trimmed.includes("*/")) inBlockComment = false;
            return;
          }
          if (trimmed.startsWith("/*")) {
            if (!trimmed.includes("*/")) inBlockComment = true;
            return;
          }
          if (CHAIN_FORM.test(line.replace(/\/\/.*$/, ""))) {
            offenders.push(
              `${relative(process.cwd(), file)}:${i + 1}: ${line.trim()}`,
            );
          }
        });
    }

    expect(offenders).toEqual([]);
  });

  it("uses the top-level form at the sites the task named", () => {
    const schema = readFileSync(
      join(SRC, "lib/validation/schemas.ts"),
      "utf8",
    );
    expect(schema).toMatch(/uuid: z\.uuid\("Invalid UUID format"\)/);
    expect(schema).toMatch(/email: z\.email\("Invalid email format"\)/);
    expect(schema).toMatch(/url: z\.url\("Invalid URL format"\)/);
  });
});

describe("the migration kept every custom message", () => {
  it("keeps 'Email is required' attached to the sign-up email check", async () => {
    const { signUpZodSchema } = await import(
      "@/src/features/auth/schemas/sign-up.schema"
    );

    // The empty string is the only input the chained `.nonempty()` could catch:
    // an invalid address already fails the format check. Dropping the chain
    // would leave "Email is required" unreachable, which is the failure this
    // assertion exists to prevent.
    const empty = signUpZodSchema.safeParse({
      email: "",
      password: "Passw0rd!",
      confirmPassword: "Passw0rd!",
    });
    expect(empty.success).toBe(false);
    expect(
      empty.success ? [] : empty.error.issues.map((i) => i.message),
    ).toContain("Email is required");

    // And a malformed address still reports the format failure, so the message
    // is additive rather than a replacement.
    const malformed = signUpZodSchema.safeParse({
      email: "not-an-email",
      password: "Passw0rd!",
      confirmPassword: "Passw0rd!",
    });
    expect(malformed.success).toBe(false);
    expect(
      malformed.success ? [] : malformed.error.issues.map((i) => i.message),
    ).toContain("Invalid email address");
  });

  it("keeps a valid address accepting", async () => {
    const { signUpZodSchema } = await import(
      "@/src/features/auth/schemas/sign-up.schema"
    );

    const ok = signUpZodSchema.safeParse({
      email: "someone@example.com",
      password: "Passw0rd!",
      confirmPassword: "Passw0rd!",
    });

    expect(ok.success).toBe(true);
  });
});

describe("behaviour is unchanged after the swap", () => {
  it("validators accept and reject exactly as before", async () => {
    const { validators } = await import("@/src/lib/validation/schemas");

    expect(validators.uuid.safeParse("33333333-3333-4333-8333-333333333333").success).toBe(true);
    expect(validators.uuid.safeParse("not-a-uuid").success).toBe(false);
    expect(
      validators.email.safeParse("someone@example.com").success,
    ).toBe(true);
    expect(validators.email.safeParse("nope").success).toBe(false);
    expect(validators.url.safeParse("https://example.com").success).toBe(true);
    expect(validators.url.safeParse("nope").success).toBe(false);

    // The task's custom messages, which the old chain form accepted as a string
    // first argument and the top-level form accepts as an options object.
    expect(
      validators.uuid.safeParse("x").error?.issues[0].message,
    ).toBe("Invalid UUID format");
    expect(
      validators.email.safeParse("x").error?.issues[0].message,
    ).toBe("Invalid email format");
    expect(
      validators.url.safeParse("x").error?.issues[0].message,
    ).toBe("Invalid URL format");
  });

  it("the GitHub url validator still rejects other hosts", async () => {
    const { validators } = await import("@/src/lib/validation/schemas");

    expect(
      validators.githubUrl.safeParse("https://github.com/owner/repo").success,
    ).toBe(true);
    expect(
      validators.githubUrl.safeParse("https://github.com/owner/repo.git")
        .success,
    ).toBe(true);
    // D-9 decided the validator, not the parser, is the gate, so a GitLab URL
    // has to keep failing here or the SSH/Enterprise decision is undone.
    expect(
      validators.githubUrl.safeParse("https://gitlab.com/owner/repo").success,
    ).toBe(false);
  });

  it("keeps the pagination cursor optional and still a uuid", async () => {
    const { paginationSchema } = await import("@/src/lib/validation/schemas");

    expect(paginationSchema.safeParse({}).success).toBe(true);
    expect(
      paginationSchema.safeParse({ cursor: "x" }).error?.issues[0].message,
    ).toBe("Invalid cursor");
    expect(
      paginationSchema.safeParse({
        cursor: "33333333-3333-4333-8333-333333333333",
      }).success,
    ).toBe(true);
  });
});

/** Path separator is platform-specific; keep the guard's output stable. */
void sep;
