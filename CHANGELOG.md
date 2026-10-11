<!--
SPDX-License-Identifier: AGPL-3.0-or-later
SPDX-FileCopyrightText: 2026 KIM Hyunjae
-->

# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- `sides`, `media` and `orientation` parameters on `print_content`, `print_pdf` and `print_file`, replacing the need to write `sides=…`, `media=…` and `landscape` in the free-form `options` string. They override the same settings in `options`, `MCP_PRINTER_DEFAULT_OPTIONS` and `MCP_PRINTER_AUTO_DUPLEX`. `get_page_meta` accepts `sides`. `options` remains for other CUPS options

### Fixed

- The sheet estimate and `PAGE_COUNT_CONFIRMATION_REQUIRED` check assumed duplex whenever `MCP_PRINTER_AUTO_DUPLEX` was on, even when the call printed one-sided. It now follows the effective `sides` setting

### Changed

- **BREAKING**: Bun runs the TypeScript sources directly and there is no build step or `dist/` directory. Point MCP client configurations at `src/index.ts` instead of `dist/index.js`

## [3.0.0] - 2026-10-11

### Added

- Streamable HTTP transport: set `MCP_PRINTER_TRANSPORT=http` to serve MCP at `POST /mcp` (`MCP_PRINTER_HTTP_HOST`, `MCP_PRINTER_HTTP_PORT`). It is stateless and has no authentication, so it must sit behind an authenticating proxy. stdio remains the default
- `print_content` tool: print a document whose text the client sends (`markdown`, `html`, `code` or `text`) without a file on the server
- `print_pdf` tool: print a PDF sent as base64 (up to 5 MB)
- `MCP_PRINTER_ENABLE_FILE_TOOLS` (default `true`): set to `false` to hide `print_file`, `get_page_meta` and the `print-changed` prompt
- `MCP_PRINTER_CHROME_NO_SANDBOX` (default `false`): start Chrome with `--no-sandbox`, needed when running as root in a container
- `Containerfile` for running the HTTP server in a rootless container with the CUPS client commands, Chromium and CJK fonts

### Changed

- **BREAKING**: the runtime and tooling moved to Bun (`bun >=1.3.14`); pnpm, ESLint, Prettier and Vitest were replaced by Bun, Biome and prek. The project is built and run from source
- **BREAKING**: markdown files whose front matter selects a non-YAML engine, such as `---js`, are rejected. gray-matter evaluated such front matter as code
- File path validation now happens once, where a path enters the print flow, instead of again inside the code and markdown renderers

### Security

- Content sent through `print_content` is hardened so it cannot read or write local files: HTML gets a Content-Security-Policy and loses its `<meta>` tags, and markdown `@import`, `![[file]]`, image-only lines, embedding tags and `chrome:`/`puppeteer:` front matter are neutralized. Markdown can still embed image files that the server process can read

3.0.0 is the first release of this fork, based on [steveclarke/mcp-printer](https://github.com/steveclarke/mcp-printer) 2.0.0. See the [upstream changelog](https://github.com/steveclarke/mcp-printer/blob/22c5404ad18d14518154ef5c6f3116770a8b9ebf/CHANGELOG.md) for earlier releases.
