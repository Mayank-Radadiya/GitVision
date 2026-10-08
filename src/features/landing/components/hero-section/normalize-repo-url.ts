/** The analyzer validates syntax only; repository access is checked in the app. */
export type RepoUrlResult =
  { ok: true; url: string } | { ok: false; message: string };
const INVALID = "Enter a GitHub repository URL or owner/repo.";

export function normalizeRepoUrl(input: string): RepoUrlResult {
  const value = input.trim();
  if (!value) return { ok: false, message: INVALID };
  const candidate = /^github\.com\//i.test(value)
    ? `https://${value}`
    : /^[\w-]+\/[\w.-]+\/?$/.test(value)
      ? `https://github.com/${value}`
      : value;
  try {
    const parsed = new URL(candidate);
    // Check the original authority too: URL hides explicit default ports.
    if (
      !/^https:\/\/github\.com\//i.test(candidate) ||
      parsed.protocol !== "https:" ||
      parsed.hostname !== "github.com" ||
      parsed.username ||
      parsed.password ||
      parsed.port
    ) {
      return { ok: false, message: INVALID };
    }
    const path = parsed.pathname.replace(/\/$/, "").replace(/\.git$/, "");
    const match = /^\/([\w-]+)\/([\w.-]+)$/.exec(path);
    if (!match || /^\.+$/.test(match[2]))
      return { ok: false, message: INVALID };
    // Reject dot-segment paths before URL's automatic path normalization.
    const rawPath = candidate
      .split(/[?#]/)[0]
      .replace(/^https:\/\/github\.com/i, "");
    if (!/^\/[\w-]+\/[\w.-]+\/?$/.test(rawPath))
      return { ok: false, message: INVALID };
    return { ok: true, url: `https://github.com/${match[1]}/${match[2]}` };
  } catch {
    return { ok: false, message: INVALID };
  }
}
