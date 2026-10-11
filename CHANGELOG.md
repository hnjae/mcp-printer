<!--
SPDX-License-Identifier: AGPL-3.0-or-later
SPDX-FileCopyrightText: 2025 Steve CLARKE
SPDX-FileCopyrightText: 2026 KIM Hyunjae
-->

# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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

## [2.0.0] - 2025-10-20

### Added

- Batch operation support: AI agents can now print multiple files, check multiple page counts, or cancel multiple jobs in a single MCP tool call
- `print_file` now accepts `files` array parameter for batch printing (single operations supported via single-element arrays)
- `get_page_meta` now accepts `files` array parameter for batch metadata retrieval
- `cancel_print_job` now accepts `jobs` array parameter for batch cancellations
- All batch operations support partial success - processing continues on individual failures
- Detailed batch operation results showing success/failure status for each item
- Batch size validation with recommended limit of 50 items per operation

### Changed

- **BREAKING**: `print_file` API signature changed to accept `files` array instead of individual file parameters
- **BREAKING**: `get_page_meta` API signature changed to accept `files` array instead of individual file parameters
- **BREAKING**: `cancel_print_job` API signature changed to accept `jobs` array instead of individual job parameters
- Replaced `print-code-review` prompt with simpler `print-changed` prompt
- New `print-changed` prompt focuses on batch printing changed files (staged, uncommitted, branch)
- Removed complex code review document generation from prompts (stayed printer-focused)

## [1.3.0] - 2025-10-15

### Added

- Shebang detection for automatic code file identification
- Files without standard extensions that contain shebangs (`#!/bin/bash`, `#!/usr/bin/env python`, etc.) are now automatically rendered with syntax highlighting
- Support for all line ending types: Unix (`\n`), Windows (`\r\n`), and old Mac (`\r`)
- Four new test fixture files for shebang detection testing

### Enhanced

- `shouldRenderCode()` now checks for shebangs in the first 1024 bytes of files with unknown extensions
- Code rendering now works seamlessly with shell scripts, Python scripts, and other executables without file extensions

## [1.2.0] - 2025-10-14

### Added

- New `get_page_meta` tool to get page count and metadata before printing
- Page count confirmation prompt when print jobs exceed configurable threshold
- `MCP_PRINTER_CONFIRM_IF_OVER_PAGES` environment variable (default: 10 physical sheets)

### Fixed

- Markdown PDF footer layout regression where filename and page numbers were misaligned
- Footer font now matches GitHub's markdown rendering font stack for consistent typography

## [1.1.0] - 2025-10-13

### Added

- New `MCP_PRINTER_ENABLE_PROMPTS` environment variable to enable/disable prompt registration
- Prompts can now be disabled by setting `MCP_PRINTER_ENABLE_PROMPTS=false` in configuration
- Prompts are enabled by default

### Changed

- Updated `get_config` tool to display `MCP_PRINTER_ENABLE_PROMPTS` status

## [1.0.0] - 2025-10-13

### Added

- Initial release of MCP Printer
- Print files directly from AI conversations via MCP protocol
- Beautiful markdown rendering with Mermaid diagram support
- Syntax-highlighted code printing for multiple languages
- Print queue management tools
- Printer configuration and management
- Security features with path restrictions and dotfile blocking
- Support for macOS and Linux (CUPS)
- Configuration via environment variables
- Tools: `print_file`, `list_printers`, `get_default_printer`, `set_default_printer`, `get_print_queue`, `cancel_print_job`, `get_config`
- Automatic duplex printing support
- Code rendering with configurable syntax highlighting, line numbers, and color schemes
- Markdown rendering with GitHub-style formatting

### Documentation

- Comprehensive README with setup instructions
- Configuration guide with all environment variables
- Security documentation
- MIT License

[2.0.0]: https://github.com/steveclarke/mcp-printer/releases/tag/v2.0.0
[1.3.0]: https://github.com/steveclarke/mcp-printer/releases/tag/v1.3.0
[1.0.0]: https://github.com/steveclarke/mcp-printer/releases/tag/v1.0.0
