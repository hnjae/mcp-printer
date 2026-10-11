# Rendering

Some documents are converted to PDF before they are sent to CUPS. Rendering uses Chrome or Chromium: `MCP_PRINTER_CHROME_PATH` if set, otherwise an installation found on the system. `MCP_PRINTER_CHROME_NO_SANDBOX=true` starts Chrome without its sandbox, which is needed when the server runs as root.

## Markdown

A file ending in `.md` or `.markdown` (any case) is rendered when `MCP_PRINTER_AUTO_RENDER_MARKDOWN` is `true` (default). Rendering supports tables, KaTeX math and Mermaid diagrams, and uses a light theme suited to print.

Rendered pages carry a footer with the document's name and the page number out of the total. A Markdown file printed with `print_file` can replace the footer by setting `chrome` (or `puppeteer`) in its front matter, for example `chrome: { displayHeaderFooter: false }` to remove it; the file's own settings are then left untouched. Content from `print_content` always gets the default footer.

## Code

A file is rendered with syntax highlighting when `MCP_PRINTER_AUTO_RENDER_CODE` is `true` (default) and either:

- its extension, or for a file without an extension its lowercase name, is recognized: `js`, `jsx`, `ts`, `tsx`, `py`, `rb`, `java`, `c`, `cpp`, `cc`, `cxx`, `h`, `hpp`, `cs`, `php`, `go`, `rs`, `swift`, `kt`, `scala`, `lua`, `perl`, `pl`, `r`, `sh`, `bash`, `zsh`, `fish`, `ps1`, `vim`, `yaml`, `yml`, `json`, `xml`, `html`, `css`, `scss`, `sass`, `less`, `sql`, `makefile`, `dockerfile`, `gemfile`, `rakefile`, `vagrantfile`; or
- the file is not recognized by name but has a line starting with `#!` within its first 1,024 bytes.

A file with a Markdown extension is never selected for code rendering automatically, so when Markdown rendering is off it is printed as it is; `render: code` renders it as code.

Code rendering takes these settings, per call or by default:

| Parameter | Default | Effect |
| --- | --- | --- |
| `line_numbers` | `MCP_PRINTER_CODE_AUTO_LINE_NUMBERS` (`true`) | Show line numbers |
| `color_scheme` | `MCP_PRINTER_CODE_COLOR_SCHEME` (`atom-one-light`) | highlight.js theme name; an unknown name falls back to the default theme |
| `font_size` | `MCP_PRINTER_CODE_FONT_SIZE` (`10pt`) | CSS font size |
| `line_spacing` | `MCP_PRINTER_CODE_LINE_SPACING` (`1.5`) | CSS line height |

## Choosing the renderer

On `print_file` and `get_page_meta`, `render` chooses how a file is rendered whatever its extension and the automatic-rendering settings:

- `markdown` renders the file as Markdown.
- `code` renders the file as code.
- `none` sends the file to CUPS as it is.

Without `render`, the detection above applies.

## Failure

If rendering fails, the item fails with the reason and nothing is sent to CUPS. To print the file as it is, call again with `render: none`.

## Everything else

Files that are not rendered, such as PDFs, plain text and images, go to CUPS as they are.
