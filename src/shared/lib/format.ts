/**
 * Display formatters.
 *
 * These existed inline at a dozen call sites before this module — every one
 * with its own `Intl.NumberFormat` instance, its own idea of what a byte count
 * should read as, and its own `new Date(x).toLocaleString()`. Two surfaces
 * showing the same repository therefore formatted the same number differently,
 * which is the kind of thing nobody files a bug about and everybody notices.
 *
 * Instances are module-level on purpose: constructing an `Intl` object is
 * expensive enough that doing it inside a render is a measurable cost on a list
 * of rows, and these are stateless and safe to share.
 */

const compactNumber = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const plainNumber = new Intl.NumberFormat("en-US");

const shortDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const dateWithYear = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const weekdayShort = new Intl.DateTimeFormat("en-US", { weekday: "short" });

const dateTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** `1,204` — exact, for counts a user might read digit by digit. */
export function formatCount(value: number): string {
  return plainNumber.format(value);
}

/**
 * `1.2K` — for headline figures where the exact digit is noise.
 *
 * Deliberately not used for anything a user might need to quote back: a
 * repository with 1,240 commits is 1.2K on a chart tile and 1,240 in a table.
 */
export function formatCompact(value: number): string {
  return compactNumber.format(value);
}

/**
 * Bytes as a human unit.
 *
 * The only correct implementation of this is non-obvious: dividing by 1024 four
 * times and rounding at each step reports a 1,539-byte file as `2 KB`. So the
 * scale is chosen from the value and only then rounded.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const scaled = bytes / 1024 ** exponent;
  const digits = exponent === 0 ? 0 : scaled < 10 ? 1 : 0;
  return `${scaled.toFixed(digits)} ${units[exponent]}`;
}

/**
 * Compact token counts.
 *
 * A whole-index footprint runs to eight digits, so `1,204,882` is not a
 * readable headline. Tokens are an approximation to begin with (they come from
 * the chunker's own count), so the compact form is honest about the precision
 * it does not have.
 */
export function formatTokens(tokens: number): string {
  if (!Number.isFinite(tokens) || tokens <= 0) return "0";
  if (tokens < 1000) return plainNumber.format(Math.round(tokens));
  if (tokens < 1_000_000) return `${compactNumber.format(tokens)}`;
  return `${(tokens / 1_000_000).toFixed(tokens < 10_000_000 ? 1 : 0)}M`;
}

/** Coerces the `Date | string` that crosses the tRPC boundary into a `Date`. */
function toDate(value: Date | string): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `Mar 14` — inside the last year, where the year is implied. */
export function formatShortDate(value: Date | string): string {
  const date = toDate(value);
  if (!date) return "—";
  return date.getFullYear() === new Date().getFullYear()
    ? shortDate.format(date)
    : dateWithYear.format(date);
}

/** `Mar 14, 2025` */
export function formatDate(value: Date | string): string {
  const date = toDate(value);
  return date ? dateWithYear.format(date) : "—";
}

/** `Mon` — axis tick labels on a daily chart. */
export function formatWeekday(value: Date | string): string {
  const date = toDate(value);
  return date ? weekdayShort.format(date) : "";
}

/** `Mar 14, 2:05 PM` — where the time is the point, not the date. */
export function formatDateTime(value: Date | string): string {
  const date = toDate(value);
  return date ? dateTime.format(date) : "—";
}

/**
 * `3 days ago`, `just now` — `date-fns` does this properly and is already a
 * dependency; this only exists so callers have one import for the whole family.
 */
export function formatRelative(
  value: Date | string,
  now: Date = new Date(),
): string {
  const date = toDate(value);
  if (!date) return "—";
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  const relative = new Intl.RelativeTimeFormat("en-US", {
    numeric: "auto",
    style: "long",
  });
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) {
      return relative.format(Math.round(seconds / size), unit);
    }
  }
  return relative.format(seconds, "second");
}

/** `4h ago` — the dense variant, for table cells and timelines. */
export function formatRelativeShort(
  value: Date | string,
  now: Date = new Date(),
): string {
  const date = toDate(value);
  if (!date) return "—";
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  const relative = new Intl.RelativeTimeFormat("en-US", {
    numeric: "auto",
    style: "narrow",
  });
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) {
      return relative.format(Math.round(seconds / size), unit);
    }
  }
  return relative.format(seconds, "second");
}

/** `+18%` / `−12%` — signed on purpose: an unsigned "12%" hides which way. */
export function formatDelta(fraction: number): string {
  const percent = Math.round(fraction * 100);
  if (percent === 0) return "0%";
  return `${percent > 0 ? "+" : "−"}${Math.abs(percent)}%`;
}