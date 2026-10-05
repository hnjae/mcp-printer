<!--
SPDX-License-Identifier: AGPL-3.0-or-later
SPDX-FileCopyrightText: 2026 KIM Hyunjae
-->

# Git Hooks with prek

This project uses treefmt to format and typos to check staged files before commits, runs `just lint` before pushes, and uses Cocogitto to check commit messages against its default Conventional Commits rules.

## Setup

Enter the Nix shell to make Bun and the hook tools available and install both Git hooks automatically. Then install JavaScript dependencies:

```sh
nix-shell
bun install --frozen-lockfile
```

## Hooks

- **treefmt** runs Biome, Taplo, nixfmt, yamlfmt, and rumdl based on `treefmt.toml`.
- **typos** checks spelling in staged files before commits.
- **just lint** runs Biome against the project before each push.
- **Cocogitto** rejects commit messages that do not follow Conventional Commits.

Run `just format` to format the full repository, `just format-check` to check formatting in CI mode, and `just typos` to check spelling across the repository. Run `prek run --all-files` to run the pre-commit hooks across tracked files, or `prek run --hook-stage pre-push` to run the push checks manually. Run `prek validate-config .pre-commit-config.yaml` to check the prek configuration. `just ci` runs typos as well as the other CI checks. The Nix shell installs the prek `pre-commit` and `pre-push` hooks, plus the Cocogitto `commit-msg` hook defined in `cog.toml`, when entered.
