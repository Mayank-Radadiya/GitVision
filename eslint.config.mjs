import nextPlugin from "@next/eslint-plugin-next";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

const nextRules = {
  ...nextPlugin.configs.recommended.rules,
  ...nextPlugin.configs["core-web-vitals"].rules,
};

const eslintConfig = [
  {
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: nextRules,
  },
  {
    // The block above carries no `files` key, so without this the TypeScript
    // sources — every rule this project actually cares about — are never
    // linted at all. Parse them, and register the TS plugin so that the
    // existing `@typescript-eslint/no-explicit-any` disable comments in the
    // tree resolve instead of erroring as unknown rules.
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    languageOptions: {
      parser: tsParser,
    },
    rules: nextRules,
  },
  {
    // Every GitHub request goes through src/lib/github/client.ts, which owns
    // auth headers, retry, and the 5-class error taxonomy. A service module
    // reaching for axios bypasses all three. Tarball streaming is the one
    // request that genuinely needs a raw response stream, and it now lives in
    // client.ts as fetchRepoTarballStream.
    files: ["src/lib/github/services/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["axios"],
              message:
                "Use the shared Octokit/axios client in src/lib/github/client.ts instead of a hand-rolled GitHub request.",
            },
          ],
        },
      ],
    },
  },
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "dist/**",
      "out/**",
      "coverage/**",
      // Vendored agent skill assets, not project source. Several are
      // placeholder templates that are not parseable TypeScript.
      ".agents/**",
    ],
  },
];

export default eslintConfig;
