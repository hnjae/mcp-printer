#!/usr/bin/env -S just --justfile
# SPDX-License-Identifier: AGPL-3.0-or-later
# SPDX-FileCopyrightText: 2026 KIM Hyunjae

set unstable
set fallback := false
set lazy

_:
    @just --list

[group('hooks')]
hooks-install:
    prek install
    cog install-hook commit-msg --overwrite

[group('test')]
test: test-unit test-integration

[group('test')]
test-unit:
    bun test --isolate tests/unit

[group('test')]
test-integration:
    bun test --isolate tests/integration --timeout=30000

[group('test')]
test-watch:
    bun test --watch tests/unit

[group('test')]
test-coverage:
    bun test --coverage --timeout=30000

[group('ci')]
ci: lint typecheck typos format-check test
    reuse lint
    prek validate-config .pre-commit-config.yaml

[group('lint')]
lint:
    bun x biome lint src tests package.json tsconfig.json biome.jsonc
    hadolint Containerfile
    actionlint

[group('lint')]
typecheck:
    bun x tsc

[group('lint')]
typos:
    typos

[group('lint')]
lint-fix:
    bun x biome lint --write src tests package.json tsconfig.json biome.jsonc

[group('format')]
format:
    treefmt

[group('format')]
format-check:
    treefmt --ci
