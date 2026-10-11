# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Changed

- **BREAKING**: `MCP_PRINTER_CODE_EXCLUDE_EXTENSIONS` is removed. Pass `render: none` for a file that should be printed as it is, or set `MCP_PRINTER_AUTO_RENDER_CODE=false` to turn automatic code rendering off
- **BREAKING**: `print_file` and `get_page_meta` take one `render` parameter (`markdown`, `code` or `none`) in place of `force_markdown_render` and `force_code_render`. It applies whatever the file's extension; omit it to detect from the extension and the configuration. `render: markdown` now also renders a file without a Markdown extension

### Fixed

- Calls no longer wait indefinitely when the CUPS server does not answer: queries time out after 10 seconds and job submissions and changes after 60 seconds

## [3.0.0-alpha] - 2026-10-11

### Added

- Streamable HTTP transport: set `MCP_PRINTER_TRANSPORT=http` to serve MCP at `POST /mcp` (`MCP_PRINTER_HTTP_HOST`, `MCP_PRINTER_HTTP_PORT`). It is stateless and has no authentication, so it must sit behind an authenticating proxy. stdio remains the default
- `print_content` tool: print a document whose text the client sends (`markdown`, `html`, `code` or `text`) without a file on the server
- `print_pdf` tool: print a PDF sent as base64 (up to 5 MB)
- `MCP_PRINTER_ENABLE_FILE_TOOLS` (default `true`): set to `false` to hide `print_file`, `get_page_meta` and the `print-changed` prompt
- `MCP_PRINTER_CHROME_NO_SANDBOX` (default `false`): start Chrome with `--no-sandbox`, needed when running as root in a container
- `Containerfile` for running the HTTP server in a rootless container with the CUPS client commands, Chromium and CJK fonts
- `sides`, `media`, `orientation` and `quality` parameters on `print_content`, `print_pdf` and `print_file`, replacing the need to write `sides=…`, `media=…`, `landscape` and `cupsPrintQuality=…` in the free-form `options` string. They override the same settings in `options`, `MCP_PRINTER_DEFAULT_OPTIONS` and `MCP_PRINTER_AUTO_DUPLEX`. `get_page_meta` accepts `sides`. `options` remains for other CUPS options
- `list_printers` reports the `sides`, `media` and `quality` values each printer accepts, read from `lpoptions -l`. It offers `jis_b5_182x257mm` and `jis_b6_128x182mm` under that name on every printer that can print the size, whether or not the printer lists it itself, and sends the printer's own choice or, failing that, `Custom.182x257mm` / `Custom.128x182mm`. A printer without its own listing gets the size when it lists A4 (B5) or A5 (B6) and custom page sizes

### Changed

- **BREAKING**: the runtime and tooling moved to Bun (`bun >=1.3.14`); pnpm, ESLint, Prettier and Vitest were replaced by Bun, Biome and prek. The sources run directly with no build step or `dist/` directory, so point MCP client configurations at `src/index.ts` instead of `dist/index.js`
- **BREAKING**: markdown files whose front matter selects a non-YAML engine, such as `---js`, are rejected. gray-matter evaluated such front matter as code
- File path validation now happens once, where a path enters the print flow, instead of again inside the code and markdown renderers

### Fixed

- The sheet estimate and `PAGE_COUNT_CONFIRMATION_REQUIRED` check assumed duplex whenever `MCP_PRINTER_AUTO_DUPLEX` was on, even when the call printed one-sided. It now follows the effective `sides` setting
- A Markdown file that was not rendered as Markdown (`force_markdown_render: false`, or `MCP_PRINTER_AUTO_RENDER_MARKDOWN=false`) was rendered as code instead. It is now printed as it is; `force_code_render: true` renders it as code

### Security

- Content sent through `print_content` is hardened so it cannot read or write local files: HTML gets a Content-Security-Policy and loses its `<meta>` tags, and markdown `@import`, `![[file]]`, image-only lines, embedding tags and `chrome:`/`puppeteer:` front matter are neutralized. Markdown can still embed image files that the server process can read

3.0.0-alpha is the first release of this fork, based on [steveclarke/mcp-printer](https://github.com/steveclarke/mcp-printer) 2.0.0. See the [upstream changelog](https://github.com/steveclarke/mcp-printer/blob/22c5404ad18d14518154ef5c6f3116770a8b9ebf/CHANGELOG.md) for earlier releases.
