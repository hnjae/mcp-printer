# MCP Printer

Print documents from an AI assistant through the Model Context Protocol (MCP). MCP Printer uses CUPS on macOS and Linux to submit print jobs, query printers, and inspect queues.

[![License: AGPL-3.0-or-later](https://img.shields.io/badge/License-AGPL--3.0--or--later-blue.svg)](LICENSE)
[![CI](https://github.com/hnjae/mcp-printer/actions/workflows/ci.yml/badge.svg)](https://github.com/hnjae/mcp-printer/actions/workflows/ci.yml)

[Install](#install-from-source) · [Connect](#connect-an-mcp-client) · [Container](#run-in-a-container) · [Tools](#tools-and-examples) · [Configuration](#configuration)

- Print text supplied by the client as Markdown, HTML, highlighted code, or plain text.
- Send small PDFs as base64, or print files already on the server.
- Render Markdown with tables, KaTeX math, and Mermaid diagrams; render source files with syntax highlighting and optional line numbers.
- Check PDF page counts before printing, choose sides, paper size, orientation, and quality, and process files in batches.
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
        "MCP_PRINTER_DEFAULT_OPTIONS": "sides=two-sided-long-edge"
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
| `list_printers` | List CUPS printers, their status, and the `sides`, `media`, and `quality` values each accepts. | Always |
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
  "sides": "two-sided-long-edge"
}
```

Print a file on the server with `print_file`:

```json
{
  "files": [
    {
      "file_path": "/home/alice/Documents/report.md",
      "copies": 1,
      "media": "A4",
      "sides": "two-sided-long-edge"
    }
  ]
}
```

Replace the example path with an allowed path on the server. `print_file`, `get_page_meta`, and `cancel_print_job` take arrays even for one item, with at most 50 items per call.

Print calls accept `printer`, `copies`, the typed settings `sides`, `media`, `orientation`, and `quality`, and an `options` string for any other CUPS option. `list_printers` shows the values each printer accepts, including `jis_b5_182x257mm` and `jis_b6_128x182mm`. Markdown and code files are rendered to PDF before printing.

A PDF that would use more sheets than the threshold (default 10) is not printed until the user approves and the call is repeated with `skip_confirmation: true`. The `print-changed` prompt prints the files changed in a git context.

Parameters, limits, and behavior are specified in [docs/spec](docs/spec/README.md).

## Configuration

Set `MCP_PRINTER_*` environment variables before starting the server, and restart it to apply changes. The [configuration reference](docs/spec/configuration.md) lists every variable with its default. The most common ones:

- `MCP_PRINTER_DEFAULT_PRINTER`: print target when a call names no printer.
- `MCP_PRINTER_ALLOWED_PATHS`: colon-separated directories that file tools may read. A nonempty value **replaces** the default `~/Documents:~/Downloads:~/Desktop`.
- `MCP_PRINTER_DEFAULT_OPTIONS`: CUPS options for every job, for example `sides=two-sided-long-edge` to print two-sided by default.
- `MCP_PRINTER_ENABLE_FILE_TOOLS` and `MCP_PRINTER_ENABLE_MANAGEMENT`: choose which tools are registered. Management enables `cancel_print_job`, which can cancel other users' jobs where CUPS permits, and `set_default_printer`.

Defaults describe a source installation; the container overrides transport, HTTP host, and file-tool availability as described above.

### File access

File tools check original and resolved paths for hidden components and resolve symlinks before checking allowed and denied paths. Dotfiles, hidden directories, and built-in restricted paths such as `/etc`, `/var`, and `/tmp` cannot be allowed through configuration.

> [!IMPORTANT]
> File-path restrictions apply to the document passed to file tools, not every resource a renderer may embed. Client-supplied Markdown disables file-import directives and embedding tags, but can still embed image files readable by the server process. Run with only the filesystem access you intend to expose. Client-supplied HTML permits inline styles and `data:` images/fonts, and blocks scripts and external or local resource loads.

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

Draft the release's `CHANGELOG.md` section from the commits with `cog changelog vPREVIOUS..HEAD` and edit it by hand; the changelog is not updated between releases. Set the `package.json` version, run `just ci`, then push a `vX.Y.Z` tag. The [image workflow](.github/workflows/image.yml) fails if the tag does not match the `package.json` version.

## License

This fork is licensed under AGPL-3.0-or-later. It derives from [steveclarke/mcp-printer](https://github.com/steveclarke/mcp-printer); the upstream MIT copyright and permission notice are preserved in [LICENSE](LICENSE).
