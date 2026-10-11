# Configuration

The server is configured with environment variables, read once at startup; restart it to apply changes. Booleans accept `true` or `false`. The defaults below are the server's own; a deployment such as the container image may override some of them.

## Connection and printing

| Variable | Default | Effect |
| --- | --- | --- |
| `MCP_PRINTER_TRANSPORT` | `stdio` | `stdio` or `http` ([transports](transports.md)). |
| `MCP_PRINTER_HTTP_HOST` | `127.0.0.1` | HTTP bind address. |
| `MCP_PRINTER_HTTP_PORT` | `3000` | HTTP port. |
| `MCP_PRINTER_DEFAULT_PRINTER` | Unset | Print target when a call has no `printer`; otherwise CUPS chooses its default. |
| `MCP_PRINTER_DEFAULT_OPTIONS` | Unset | Space-separated CUPS options applied to every job; the call's settings override them ([print-settings](print-settings.md)). |
| `MCP_PRINTER_AUTO_DUPLEX` | `false` | Print two-sided on the long edge unless a call, or `MCP_PRINTER_DEFAULT_OPTIONS`, sets `sides`. |
| `MCP_PRINTER_MAX_COPIES` | `10` | Maximum `copies` per job; `0` or a negative value removes the limit. |
| `MCP_PRINTER_CONFIRM_IF_OVER_PAGES` | `10` | Sheet threshold for [page confirmation](page-confirmation.md); `0` disables it. |
| `MCP_PRINTER_ENABLE_MANAGEMENT` | `false` | Register `cancel_print_job` and `set_default_printer` ([tool-availability](tool-availability.md)). |
| `MCP_PRINTER_ENABLE_FILE_TOOLS` | `true` | Register `print_file` and `get_page_meta`; disabling also removes the `print-changed` prompt. |
| `MCP_PRINTER_ENABLE_PROMPTS` | `true` | Register prompts, which also requires file tools. |

## File access

| Variable | Default | Effect |
| --- | --- | --- |
| `MCP_PRINTER_ALLOWED_PATHS` | `~/Documents:~/Downloads:~/Desktop` | Colon-separated allowed paths. A nonempty value replaces the default list ([file-access](file-access.md)). |
| `MCP_PRINTER_DENIED_PATHS` | Unset | Colon-separated paths denied in addition to the built-in list. |

## Rendering

| Variable | Default | Effect |
| --- | --- | --- |
| `MCP_PRINTER_CHROME_PATH` | Auto-detected | Path to Chrome or Chromium ([rendering](rendering.md)). |
| `MCP_PRINTER_CHROME_NO_SANDBOX` | `false` | Start Chrome without its sandbox, needed when running as root. |
| `MCP_PRINTER_AUTO_RENDER_MARKDOWN` | `true` | Render `.md` and `.markdown` files to PDF. |
| `MCP_PRINTER_AUTO_RENDER_CODE` | `true` | Render recognized code files and shebang scripts to PDF. |
| `MCP_PRINTER_FALLBACK_ON_RENDER_ERROR` | `false` | Send the original file when rendering fails. |
| `MCP_PRINTER_CODE_EXCLUDE_EXTENSIONS` | Unset | Comma-separated names excluded from code rendering. |
| `MCP_PRINTER_CODE_COLOR_SCHEME` | `atom-one-light` | Default highlight.js theme. |
| `MCP_PRINTER_CODE_AUTO_LINE_NUMBERS` | `true` | Default for line numbers in code output. |
| `MCP_PRINTER_CODE_FONT_SIZE` | `10pt` | Default code font size. |
| `MCP_PRINTER_CODE_LINE_SPACING` | `1.5` | Default code line spacing. |

The automatic-rendering switches and the fallback setting govern `print_file` and `get_page_meta`. `print_content` renders according to its explicit `format`.
