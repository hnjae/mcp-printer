<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- SPDX-FileCopyrightText: 2026 KIM Hyunjae -->

# Release Announcement Guide

Use these templates only after creating a GitHub source release for this fork. The fork is not published to npm; users install it by building from source.

## Short announcement

```text
MCP Printer fork release [VERSION] is available.

This source-only fork prints documents through CUPS and supports markdown and code rendering.

Source and release notes: https://github.com/hnjae/mcp-printer/releases
Build instructions: https://github.com/hnjae/mcp-printer#installation
```

## Longer announcement

```text
This is a source-maintained fork of Steve CLARKE's MCP Printer project.

It provides an MCP server for printing documents through CUPS on macOS and Linux, with markdown and code rendering.

Install from the fork by cloning the repository, running `bun install --frozen-lockfile` and `just build`, then configuring your MCP client to run `bun` with the absolute path to `dist/index.js`.

Source and release notes: https://github.com/hnjae/mcp-printer/releases
```

Keep the upstream attribution and the license notices described in `LICENSE` when announcing or redistributing the fork.
