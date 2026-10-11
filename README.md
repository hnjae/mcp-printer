<!--
SPDX-License-Identifier: AGPL-3.0-or-later
SPDX-FileCopyrightText: 2026 KIM Hyunjae
-->

# MCP Printer

Print documents from an AI assistant through the Model Context Protocol (MCP). MCP Printer uses CUPS on macOS and Linux to submit print jobs, query printers, and inspect queues.

[![License: AGPL-3.0-or-later](https://img.shields.io/badge/License-AGPL--3.0--or--later-blue.svg)](LICENSE)
[![CI](https://github.com/hnjae/mcp-printer/actions/workflows/ci.yml/badge.svg)](https://github.com/hnjae/mcp-printer/actions/workflows/ci.yml)

[Install](#install-from-source) · [Connect](#connect-an-mcp-client) · [Container](#run-in-a-container) · [Tools](#tools-and-examples) · [Configuration](#configuration)

- Print text supplied by the client as Markdown, HTML, highlighted code, or plain text.
- Send small PDFs as base64, or print files already on the server.
- Render Markdown with tables, KaTeX math, and Mermaid diagrams; render source files with syntax highlighting and optional line numbers.
- Check PDF page counts before printing, choose CUPS options, and process files in batches.
- Connect over stdio or stateless Streamable HTTP; optionally enable job cancellation and default-printer management.

## Install from source

You need macOS or Linux, Bun **1.3.14 or later**, and access to a configured CUPS printer. The commands `lpr`, `lpstat`, `lpq`, `lprm`, and `lpoptions` must be on `PATH`. Chrome or Chromium is required for Markdown, HTML, code, and client-supplied text rendering. Windows is unsupported.

Check that CUPS can see your printers:

```sh
lpstat -p -d
```

Clone the server and install its dependencies:

```sh
git clone https://github.com/hnjae/mcp-printer.git
cd mcp-printer
bun install --frozen-lockfile
```

Run it with `bun src/index.ts`; Bun runs the TypeScript sources directly, so there is no build step. The default transport is stdio, so it waits for an MCP client rather than opening a web page. Logs go to stderr.

This fork is not published to npm; the unscoped npm package `mcp-printer` is the upstream project.

## Connect an MCP client

### stdio

For clients that use an `mcpServers` configuration, add:

```json
{
  "mcpServers": {
    "printer": {
      "command": "/absolute/path/to/bun",
      "args": ["/absolute/path/to/mcp-printer/src/index.ts"],
      "env": {
        "MCP_PRINTER_ALLOWED_PATHS": "~/Documents:~/Downloads:~/Desktop",
        "MCP_PRINTER_AUTO_DUPLEX": "true"
      }
    }
  }
}
```

Replace both executable paths with your local paths; `command -v bun` shows the Bun path. Restart or reload your client after changing its configuration. Use `list_printers` to discover printer names, then pass `printer` in a tool call or set `MCP_PRINTER_DEFAULT_PRINTER` in `env`.

### Streamable HTTP

Start the server from the repository directory:

```sh
MCP_PRINTER_TRANSPORT=http bun src/index.ts
```

Configure your client's Streamable HTTP connection with `http://127.0.0.1:3000/mcp`. The endpoint accepts `POST` and returns JSON; it has no persistent sessions or GET event stream.

Verify the connection without submitting a print job:

```sh
curl --fail-with-body http://127.0.0.1:3000/mcp \
  --header 'content-type: application/json' \
  --header 'accept: application/json, text/event-stream' \
  --data '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

> [!WARNING]
> HTTP has no authentication. Keep the listener on loopback, or put it behind an authenticating proxy before making it reachable by other machines. A connected client can submit print jobs and invoke every enabled tool.

## Run in a container

The container includes Bun, CUPS client commands, Chromium, and CJK fonts. It connects to an existing CUPS server; it does not run a CUPS daemon.

Build from this checkout and run with a CUPS server reachable from the container:

```sh
docker build -f Containerfile -t mcp-printer .
docker run --rm --name mcp-printer \
  -p 127.0.0.1:3000:3000 \
  -e CUPS_SERVER=cups.example.internal:631 \
  mcp-printer
```

Replace `cups.example.internal:631` with your CUPS server address and port. Its access rules must permit this client. Use the same HTTP connection and smoke check shown above. If Chrome crashes while rendering, add `--shm-size=1g`. Release tags matching `package.json` trigger image publication to `ghcr.io/hnjae/mcp-printer` through the [image workflow](.github/workflows/image.yml).

The container runs as the `bun` user, listens on `0.0.0.0:3000` internally, and disables file tools by default. `print_content` and `print_pdf` work without document mounts. To print mounted files, add these options to `docker run`:

```sh
--mount type=bind,source=/absolute/path/to/documents,target=/documents,readonly \
-e MCP_PRINTER_ENABLE_FILE_TOOLS=true \
-e MCP_PRINTER_ALLOWED_PATHS=/documents
```

Mounted documents must be readable by the container user. If Chrome cannot start its sandbox under your container runtime, set `MCP_PRINTER_CHROME_NO_SANDBOX=true`; this disables Chrome's sandbox.

To use the host's CUPS daemon instead of `CUPS_SERVER`, mount its socket. With rootless Podman, map your user to the container's `bun` user (uid 1000); on SELinux hosts, add `:z` to the mount:

```sh
podman run --rm --name mcp-printer \
  --userns=keep-id:uid=1000,gid=1000 \
  -v /run/cups/cups.sock:/run/cups/cups.sock \
  -p 127.0.0.1:3000:3000 \
  mcp-printer
```

CUPS records jobs from the container as owned by `unknown`, so virtual printers that write per-user output, such as `cups-pdf`, cannot deliver them. `set_default_printer` changes the container user's CUPS default, not the host's.

## Tools and examples

| Tool | Purpose | Availability |
| --- | --- | --- |
| `print_content` | Render and print supplied `content` with `format`: `markdown`, `html`, `code`, or `text`. | Always |
| `print_pdf` | Print a readable PDF supplied as `pdf_base64`, up to 5 MiB decoded. | Always |
| `print_file` | Print server-side paths from a `files` array; Markdown and known code files render automatically. | File tools enabled |
| `get_page_meta` | Get PDF pages and estimated physical sheets from a `files` array, rendering Markdown/code first when needed. | File tools enabled |
| `list_printers` | List CUPS printers and their status. | Always |
| `get_default_printer` | Query the CUPS default printer. | Always |
| `get_print_queue` | Inspect the queue, optionally for a named `printer`. | Always |
| `get_config` | Inspect active server settings. | Always |
| `cancel_print_job` | Cancel job IDs or all jobs for a printer through a `jobs` array. | Management enabled |
| `set_default_printer` | Set the CUPS default printer. | Management enabled |

The following JSON objects are tool arguments, not complete MCP requests. They submit print jobs when passed to the named tool.

Print a document written in the conversation with `print_content`:

```json
{
  "content": "# Meeting notes\n\n- Review the proposal\n- Decide on next steps\n",
  "format": "markdown",
  "options": "sides=two-sided-long-edge"
}
```

Print a file on the server with `print_file`:

```json
{
  "files": [
    {
      "file_path": "/home/alice/Documents/report.md",
      "copies": 1,
      "options": "media=A4 sides=two-sided-long-edge"
    }
  ]
}
```

Replace the example path with an allowed path on the server. File printing and page metadata calls use `files` arrays even for one file; cancellations use `jobs` arrays. Each batch processes at most 50 items per call. Larger batches return a warning without processing; split them into smaller calls. Individual failures do not stop the remaining items.

Print calls accept `printer`, `copies`, and space-separated CUPS `options`, such as `landscape`, `media=A4`, or `sides=two-sided-long-edge`. Supported options depend on the printer; `lpoptions -l` lists them. Code rendering accepts `line_numbers`, `color_scheme`, `font_size`, and `line_spacing`; `print_content` with `format: "code"` also accepts `language`, such as `py` or `ts`. File tools accept `force_markdown_render` and `force_code_render` to override automatic detection.

When a readable PDF exceeds the configured sheet threshold, the server returns `PAGE_COUNT_CONFIRMATION_REQUIRED` without printing it. After the user approves, repeat the call with `skip_confirmation: true`. The default threshold is 10 sheets; the estimate accounts for duplex but does not multiply by copies. The check does not apply to file formats whose PDF page count cannot be read. `get_page_meta` requires a PDF or a file that can be rendered to PDF.

The `print-changed` prompt guides the assistant through printing staged changes, unstaged changes (`uncommitted`), or the diff of the current or a named branch against `main`. It requires the client to discover changed files and is available when both prompts and file tools are enabled.

## Configuration

Set environment variables before starting the server. Restart it to apply changes. Booleans accept `true` or `false`. Defaults below describe a source installation; the container overrides transport, HTTP host, and file-tool availability as described above.

### Connection and printing

| Variable | Default | Effect |
| --- | --- | --- |
| `MCP_PRINTER_TRANSPORT` | `stdio` | `stdio` or `http`. |
| `MCP_PRINTER_HTTP_HOST` | `127.0.0.1` | HTTP bind address. |
| `MCP_PRINTER_HTTP_PORT` | `3000` | HTTP port. |
| `MCP_PRINTER_DEFAULT_PRINTER` | Unset | Print target when no `printer` is supplied; otherwise CUPS chooses its default. |
| `MCP_PRINTER_DEFAULT_OPTIONS` | Unset | Space-separated CUPS options; per-call options follow them. |
| `MCP_PRINTER_AUTO_DUPLEX` | `false` | Add `sides=two-sided-long-edge` unless the call supplies a `sides=` option. |
| `MCP_PRINTER_MAX_COPIES` | `10` | Maximum copies per job; `0` or a negative value removes the limit. |
| `MCP_PRINTER_CONFIRM_IF_OVER_PAGES` | `10` | Physical-sheet threshold for PDF confirmation; `0` disables it. |
| `MCP_PRINTER_ENABLE_MANAGEMENT` | `false` | Register `cancel_print_job` and `set_default_printer`, which change the server user's default printer and cancel queued jobs, including other users' jobs where CUPS permits. Printing remains available when disabled. |
| `MCP_PRINTER_ENABLE_FILE_TOOLS` | `true` | Register `print_file` and `get_page_meta`; disabling also hides `print-changed`. |
| `MCP_PRINTER_ENABLE_PROMPTS` | `true` | Enable workflow prompts when file tools are enabled. |

### File access

| Variable | Default | Effect |
| --- | --- | --- |
| `MCP_PRINTER_ALLOWED_PATHS` | `~/Documents:~/Downloads:~/Desktop` | Colon-separated allowed paths. A nonempty value **replaces** the defaults. Supports `~`, `$HOME`, and `${HOME}`. |
| `MCP_PRINTER_DENIED_PATHS` | Built-in restricted paths | Colon-separated paths added to the built-in deny list; denial takes precedence. |

File tools check original and resolved paths for hidden components and resolve symlinks before checking allowed and denied paths. Dotfiles, hidden directories, and built-in restricted paths cannot be allowed through configuration. The full deny list is in [src/config.ts](src/config.ts); it includes sensitive directories and system paths such as `/etc`, `/var`, and `/tmp`.

> [!IMPORTANT]
> File-path restrictions apply to the document passed to file tools, not every resource a renderer may embed. Client-supplied Markdown disables file-import directives and embedding tags, but can still embed image files readable by the server process. Run with only the filesystem access you intend to expose. Client-supplied HTML permits inline styles and `data:` images/fonts, and blocks scripts and external or local resource loads.

### Rendering

| Variable | Default | Effect |
| --- | --- | --- |
| `MCP_PRINTER_CHROME_PATH` | Auto-detected | Path to Chrome or Chromium. |
| `MCP_PRINTER_CHROME_NO_SANDBOX` | `false` | Launch Chrome with `--no-sandbox`, needed when running as root. |
| `MCP_PRINTER_AUTO_RENDER_MARKDOWN` | `true` | Render `.md` and `.markdown` files to PDF. |
| `MCP_PRINTER_AUTO_RENDER_CODE` | `true` | Render known code files and detected shebang scripts to PDF. |
| `MCP_PRINTER_FALLBACK_ON_RENDER_ERROR` | `false` | Submit the original file if automatic Markdown/code rendering fails. |
| `MCP_PRINTER_CODE_EXCLUDE_EXTENSIONS` | Unset | Comma-separated extensions excluded from automatic code rendering. |
| `MCP_PRINTER_CODE_COLOR_SCHEME` | `atom-one-light` | highlight.js theme. |
| `MCP_PRINTER_CODE_AUTO_LINE_NUMBERS` | `true` | Include line numbers in code output. |
| `MCP_PRINTER_CODE_FONT_SIZE` | `10pt` | Code font size. |
| `MCP_PRINTER_CODE_LINE_SPACING` | `1.5` | Code line spacing. |

The automatic-rendering switches and fallback setting govern file printing. `print_content` renders according to its explicit `format`; text content is escaped and rendered as a monospace PDF. Its limit is 1,000,000 characters. Markdown front matter that selects a non-YAML engine, such as `---js`, is rejected.

Rendered Markdown files get a page-number footer. In a file printed through `print_file`, front matter can replace it with Chrome's PDF options, for example `chrome: { displayHeaderFooter: false }` to remove it or a custom `footerTemplate`.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| No printers or CUPS connection failure | Run `lpstat -p -d` in the same host/container environment. Verify the CUPS service, `CUPS_SERVER`, and server access rules. |
| Chrome not found or rendering fails | Install Chrome/Chromium or set `MCP_PRINTER_CHROME_PATH` to its executable. For container sandbox failures, see the container instructions. |
| File access denied | Use an absolute path under an allowed directory. Custom allowed paths replace defaults; hidden components and built-in denied paths remain blocked. |
| Expected tool is missing | Check `MCP_PRINTER_ENABLE_FILE_TOOLS` and `MCP_PRINTER_ENABLE_MANAGEMENT`, then restart the server and refresh the client's tool list. |
| HTTP returns `405` | Use a Streamable HTTP client that sends `POST /mcp`; browser GET requests and SSE-only clients cannot use this endpoint. |

## Development

The [justfile](justfile) defines type-checking, test, formatting, and CI commands. `nix-shell` provides the development tools, including Chromium and CUPS clients, and installs Git hooks on entry. Without Nix, install the tools used by the recipes yourself.

```sh
nix-shell
bun install --frozen-lockfile
just ci
```

For narrower checks, use `just typecheck`, `just test-unit`, or `just test-integration`. Integration tests render PDFs with Chrome/Chromium. Restart the running server to load source changes. `just format` applies formatters, and `just hooks-install` installs the formatting, typo, and Conventional Commit hooks.

### Releasing

Update `CHANGELOG.md` and the `package.json` version, run `just ci`, then push a `vX.Y.Z` tag. The [image workflow](.github/workflows/image.yml) fails if the tag does not match the `package.json` version.

## License

This fork is licensed under AGPL-3.0-or-later. It derives from [steveclarke/mcp-printer](https://github.com/steveclarke/mcp-printer); the upstream MIT copyright and permission notice are preserved in [LICENSE](LICENSE).
