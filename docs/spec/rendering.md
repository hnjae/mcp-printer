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

The look of the output comes from the configuration; a call cannot change it:

| Variable | Default | Effect |
| --- | --- | --- |
| `MCP_PRINTER_CODE_AUTO_LINE_NUMBERS` | `true` | Show line numbers |
| `MCP_PRINTER_CODE_COLOR_SCHEME` | `atom-one-light` | highlight.js theme name; an unknown name falls back to the default theme |
| `MCP_PRINTER_CODE_FONT_SIZE` | `10pt` | CSS font size |
| `MCP_PRINTER_CODE_LINE_SPACING` | `1.5` | CSS line height |

Code, and `print_content` with `format: text`, is set in the first available of `ui-monospace`, Sarasa Mono K and the system's generic monospace font. Sarasa Mono K sets Hangul and other CJK characters at exactly twice the width of Latin ones, so code with such comments stays aligned. The container image includes it; on other systems install it to get the same look.

## Page size

Everything the server renders to PDF, whether Markdown, code, HTML or text, is laid out on the page size of the call's `media` ([print-settings](print-settings.md)), and on A4 when the call has no `media` or names a size the server does not know. The server knows:

- `A3`, `A4`, `A5`, `A6`, `Letter`, `Legal`, `Executive`, `Oficio` and `FanFoldGermanLegal`, in any letter case, with a variant suffix such as `.Borderless` ignored;
- `jis_b5_182x257mm` and `jis_b6_128x182mm`;
- IPP names that carry their size, such as `iso_a4_210x297mm` and `na_letter_8.5x11in`;
- a printer's own sizes named by their dimensions, such as `4x6` (inches) and `215x345mm`;
- `Custom.<W>x<H>` with mm, cm, in or pt, points when no unit is given.

Any other name, such as `JISB5` or an envelope like `EnvDL`, renders on A4 while CUPS still receives the name unchanged. `get_page_meta` takes `media` for the same reason: the page count depends on the page size.

A document can choose its own size. HTML sets it with an `@page { size: … }` rule; Markdown sets it in its front matter, for example `chrome: { format: Letter }`. A Markdown file that sets other `chrome` options without a size is still laid out on the size of the call. PDFs from `print_pdf` and files printed as they are keep their own size.

## HTML, code and text pages

These pages carry no header or footer; only Markdown has the footer described above. HTML is printed as written, backgrounds and colors included, so a page with a dark or colored background uses a lot of ink and the server does not change that.

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
