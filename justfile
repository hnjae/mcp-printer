#!/usr/bin/env -S just --justfile
# SPDX-License-Identifier: AGPL-3.0-or-later
# SPDX-FileCopyrightText: 2026 KIM Hyunjae

set unstable
set fallback := false
set lazy

_:
    @just --list

[group('build')]
clean:
    rm -rf dist

[group('build')]
build:
    bun x tsc

[group('build')]
dev:
    bun x tsc --watch

[group('hooks')]
hooks-install:
    prek install
    cog install-hook commit-msg

[group('test')]
test: test-unit test-integration

[group('test')]
test-unit:
    bun test tests/unit

[group('test')]
test-integration:
    bun test tests/integration --timeout=30000

[group('test')]
test-watch:
    bun test --watch tests/unit

[group('test')]
test-coverage:
    bun test --coverage --timeout=30000

[group('ci')]
ci: lint typos format-check test build
    reuse lint
    prek validate-config .pre-commit-config.yaml

[group('lint')]
lint:
    bun x biome lint src tests package.json tsconfig.json biome.jsonc

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
