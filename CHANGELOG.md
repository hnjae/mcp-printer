# Changelog

All notable changes to this project will be documented in this file.

## [3.0.2] - 2026-10-12

### Added

- The package is published to npm as `@hnjae/mcp-printer` (run with `bunx @hnjae/mcp-printer`; Bun is required). Pushing a `v*` tag publishes it through npm trusted publishing, and a tag containing a hyphen is published under the `next` tag

## [3.0.1] - 2026-10-11

### Fixed

- `print_pdf` accepts PDFs up to 3 MB (3,000,000 bytes) instead of 5 MB. The HTTP transport rejects request bodies over 4 MiB, so a larger PDF could never arrive that way and failed with HTTP 413; 3 MB is the largest size that fits once base64 and the request around it are counted

## [3.0.0] - 2026-10-11

### Added

- Streamable HTTP transport: set `MCP_PRINTER_TRANSPORT=http` to serve MCP at `POST /mcp` (`MCP_PRINTER_HTTP_HOST`, `MCP_PRINTER_HTTP_PORT`). It is stateless and has no authentication, so it must sit behind an authenticating proxy. stdio remains the default
- `print_content` tool: print a document whose text the client sends (`markdown`, `html`, `code` or `text`) without a file on the server
- `print_pdf` tool: print a PDF sent as base64 (up to 5 MB)
- `MCP_PRINTER_ENABLE_FILE_TOOLS` (default `true`): set to `false` to hide `print_file`, `get_page_meta` and the `print-changed` prompt
- `MCP_PRINTER_CHROME_NO_SANDBOX` (default `false`): start Chrome with `--no-sandbox`, needed when running as root in a container
- `Containerfile` for running the HTTP server in a rootless container with the CUPS client commands, Chromium, CJK fonts and the Sarasa Mono K code font. Release images are published to `ghcr.io/hnjae/mcp-printer` as `3.0.0`, `3.0`, `3` and `latest`, so `:3` follows every 3.x release
- `sides`, `media`, `orientation` and `quality` parameters on `print_content`, `print_pdf` and `print_file`, replacing the need to write `sides=…`, `media=…`, `landscape` and `cupsPrintQuality=…` in the free-form `options` string. They override the same settings in `options` and `MCP_PRINTER_DEFAULT_OPTIONS`. `get_page_meta` accepts `sides` and `media`. `options` remains for other CUPS options
- `list_printers` reports the `sides`, `media` and `quality` values each printer accepts, read from `lpoptions -l`. It offers `jis_b5_182x257mm` and `jis_b6_128x182mm` under that name on every printer that can print the size, whether or not the printer lists it itself, and sends the printer's own choice or, failing that, `Custom.182x257mm` / `Custom.128x182mm`. A printer without its own listing gets the size when it lists A4 (B5) or A5 (B6) and custom page sizes
- `render` parameter (`markdown`, `code` or `none`) on `print_file` and `get_page_meta`: renders the file that way whatever its extension, so Markdown can be rendered from a file without a Markdown extension. Omitted, the extension and the `MCP_PRINTER_AUTO_RENDER_*` settings decide as before
- Documents are rendered on the page size of the call's `media`: `A3` to `A6`, `Letter`, `Legal`, `Executive`, `Oficio`, `FanFoldGermanLegal`, the JIS B5/B6 names, IPP names that carry their size, a printer's own names made of dimensions such as `4x6` (inches) and `215x345mm`, and `Custom.<W>x<H>`. Any other name renders on A4. A size the document sets itself (HTML `@page`, Markdown front matter) wins
- Code and plain text are set in `ui-monospace`, then Sarasa Mono K, then the system's monospace font, so Korean and other CJK comments stay aligned

### Changed

- **BREAKING**: the runtime and tooling moved to Bun (`bun >=1.3.14`); pnpm, ESLint, Prettier and Vitest were replaced by Bun, Biome and prek. The sources run directly with no build step or `dist/` directory, so point MCP client configurations at `src/index.ts` instead of `dist/index.js`
- **BREAKING**: Markdown files whose front matter selects a non-YAML engine, such as `---js`, are rejected. gray-matter evaluated such front matter as code
- **BREAKING**: rendered documents are laid out on A4 instead of US Letter when the call has no `media`. Pass `media: Letter` to keep Letter
- **BREAKING**: `print_file` and `get_page_meta` no longer accept `force_markdown_render` and `force_code_render`; use `render`
- **BREAKING**: `print_content`, `print_file` and `get_page_meta` no longer accept `line_numbers`, `color_scheme`, `font_size` or `line_spacing`. The `MCP_PRINTER_CODE_*` settings control how code looks
- **BREAKING**: `MCP_PRINTER_AUTO_DUPLEX` is no longer read; set `MCP_PRINTER_DEFAULT_OPTIONS=sides=two-sided-long-edge` instead
- **BREAKING**: `MCP_PRINTER_ENABLE_PROMPTS` is no longer read; the `print-changed` prompt follows `MCP_PRINTER_ENABLE_FILE_TOOLS`
- **BREAKING**: `MCP_PRINTER_FALLBACK_ON_RENDER_ERROR` is no longer read; a failed rendering always fails that item, and `render: none` prints a file as it is
- **BREAKING**: `MCP_PRINTER_CODE_EXCLUDE_EXTENSIONS` is no longer read; use `render: none` for one file or `MCP_PRINTER_AUTO_RENDER_CODE=false` for all
- Markdown is printed without filled backgrounds: code blocks are outlined instead, block quotes keep their left bar
- File path validation now happens once, where a path enters the print flow, instead of again inside the code and Markdown renderers

### Fixed

- The sheet estimate and `PAGE_COUNT_CONFIRMATION_REQUIRED` check assumed duplex whenever `MCP_PRINTER_AUTO_DUPLEX` was on, even when the call printed one-sided. It now follows the effective `sides` setting
- A Markdown file that was not rendered as Markdown (`MCP_PRINTER_AUTO_RENDER_MARKDOWN=false`) was rendered as code instead. It is now printed as it is; `render: code` renders it as code
- CUPS output is parsed under a fixed locale, so a translated CUPS no longer breaks printer and queue parsing
- Every CUPS command has a time limit (10 seconds for queries, 60 seconds for submissions and changes), so an unreachable CUPS server no longer leaves a call waiting indefinitely
- HTML, code and plain-text PDFs no longer carry Chrome's date and the path of a temporary file as header and footer, and rendered code starts with the file's name instead of its full path
