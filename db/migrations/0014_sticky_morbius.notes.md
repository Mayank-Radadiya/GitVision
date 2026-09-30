# 0014 — `users.theme_preference`

> **Status: not executed.** Generated and reviewed, not applied to any database.
> The SQL below is what `drizzle-kit migrate` will run.

## 1. What it is for

```sql
ALTER TABLE "users" ADD COLUMN "theme_preference" varchar(16) DEFAULT 'dark' NOT NULL;
```

One column on `users` holding the F-17 theme choice: `light`, `dark`, or
`system`. Typed as `ThemePreference` in `db/schema.ts` and validated again at the
API boundary by `z.enum(["light", "dark", "system"])` in
`userRouter.setThemePreference`.

This is the cross-device half of the theme setting. `next-themes` already owns
the localStorage copy; this column is what follows the user to a second browser,
and `ThemePreferenceSection` applies it on mount when the two disagree.

## 2. Why `NOT NULL DEFAULT 'dark'`

`'dark'` matches the `defaultTheme="dark"` the root provider (`app-provider.tsx`)
has always used, so existing users see no repaint the first time they open
settings. A `'system'` default would have been defensible, but it would silently
switch anyone whose OS is light to a different theme on first load — a change
users did not ask for, arriving in a commit about a settings page.

The column is typed and constrained rather than a free-form string: the DB keeps
`varchar(16)` wide enough for `system` and nothing longer, and the enum lives in
TypeScript plus the tRPC input validator where it can be checked on write.

There is no check constraint on the column. The only writer is
`setThemePreference`, which validates before it writes; a second constraint would
restate the same enum in a place that cannot be type-checked against it.

## 3. Lock behaviour

`ADD COLUMN` with a non-volatile default is catalog-only on PostgreSQL 11+ — the
table is not rewritten and no row is touched. `users` is a small, low-write
table (one row per authenticated account), so even a rewrite would be cheap, but
the default does not force one.

## 4. Verification

Not run — see the status note at the top. To verify after applying:

```sql
-- Column exists, is varchar(16), not null, defaults to 'dark'.
SELECT column_name, character_maximum_length, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_name = 'users' AND column_name = 'theme_preference';
-- expect: theme_preference | 16 | NO | 'dark'::character varying

-- Every pre-existing row was backfilled, not left null.
SELECT theme_preference, count(*) FROM users GROUP BY 1;
-- expect one row: dark | <n>
```

If the last query returns `NULL | <n>`, the migration ran against a `users`
table that did not have the `NOT NULL` default in place.
