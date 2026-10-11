# Agent Guidelines

## Project

MCP server (TypeScript on Bun, no build step) that prints through CUPS. Entry point is `src/index.ts`; run with `bun src/index.ts` (stdio) or `MCP_PRINTER_TRANSPORT=http bun src/index.ts`. Windows is unsupported. This is a fork; the unscoped npm package `mcp-printer` is the upstream project.

## Commands

Tooling comes from `shell.nix` (`nix-shell`), which also installs the git hooks; dependencies via `bun install --frozen-lockfile`.

- `just test` — unit and integration tests. `just test-unit` / `just test-integration` run one half.
- Single file: `bun test tests/unit/cups.test.ts`; single test: `bun test tests/unit/cups.test.ts -t "<name>"`.
- Integration tests need Chrome/Chromium and run with `--timeout=30000`, also for a single file: `bun test tests/integration/markdown.test.ts --timeout=30000`.
- `just test-watch` re-runs unit tests on change; `just test-coverage` reports coverage.
- `just ci` — what CI runs: biome lint, hadolint, actionlint, editorconfig-checker, deadnix, statix, `tsc` typecheck, typos, treefmt check, tests, `reuse lint`.
- `just lint-fix` (biome), `just format` (treefmt), `just typecheck` (`bun x tsc`), `just hooks-install` (formatting, typo and Conventional Commit hooks; `nix-shell` runs it).
- Restart the running server to load source changes.
- Commit messages are verified by `cog` (Conventional Commits); every file needs SPDX headers (`reuse lint`).

## Conventions

- Relative imports use the `.ts` extension (`allowImportingTsExtensions`).
- Tests live in `tests/unit` and `tests/integration`; fixtures in `tests/fixtures`; test output goes to `tests/tmp/` (untracked). Tests assert durable contracts (accepted options, validation, output formats), not prose, logs or rendering details.
- Intended behavior is in `docs/spec/` (external behavior) and `docs/architecture/` (invariants, e.g. all CUPS contact goes through `src/cups.ts`). Update them with the change that alters what they describe.

## Releases

- `CHANGELOG.md` is not edited per commit. At release, draft the section with `cog changelog vPREVIOUS..HEAD` and edit it by hand.
- Set the `package.json` version, run `just ci`, then push a `vX.Y.Z` tag. The image workflow (`.github/workflows/image.yml`) fails if the tag differs from the `package.json` version.
- `main` changes only through pull requests.
