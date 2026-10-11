# Printing

Three tools submit print jobs. They differ in where the document comes from; everything else is shared.

| Tool | Document |
| --- | --- |
| `print_content` | Text in the call, interpreted according to `format` |
| `print_pdf` | A PDF in the call, as base64 |
| `print_file` | Files at paths on the server, given in a `files` array |

## Parameters shared by all three

- `printer`: the CUPS queue to print on. Without it, `MCP_PRINTER_DEFAULT_PRINTER` is used if set, otherwise the CUPS default printer.
- `copies`: at least 1, default 1. A value above `MCP_PRINTER_MAX_COPIES` fails the job (unless the limit is `0` or negative, which means unlimited) and names the limit.
- `sides`, `media`, `orientation`, `quality`, `options`: see [print-settings](print-settings.md).
- `skip_confirmation`: see [page-confirmation](page-confirmation.md).

## print_content

`content` is non-empty and at most 1,000,000 characters. `format` is required:

- `markdown`: rendered to PDF as described in [rendering](rendering.md), with the restrictions in [untrusted-content](untrusted-content.md).
- `html`: rendered as a self-contained page with the restrictions in [untrusted-content](untrusted-content.md).
- `code`: rendered with syntax highlighting. `language` is a file extension or language id of 1 to 20 letters, digits, `_`, `+` or `-`, such as `py` or `ts`, default `txt`; any other value fails the job. Its appearance follows [rendering](rendering.md).
- `text`: printed as plain monospace text. The text is escaped, never interpreted as markup, and long lines wrap.

## print_pdf

`pdf_base64` decodes to at most 3 MB (3,000,000 bytes) and must be a readable PDF; anything else fails the job before anything is sent to CUPS. The limit keeps the base64 request within the 4 MiB the HTTP transport accepts.

## print_file

Each entry in `files` has a `file_path` and the shared parameters. Paths are checked against [file-access](file-access.md). Markdown and recognized code files are rendered to PDF first, controlled by `render` as described in [rendering](rendering.md). Any other file is sent to CUPS unchanged, and CUPS decides whether it can print it. Entries are processed as described in [batches](batches.md).

## Result

A call returns one result per document: the printer used on success, or the reason for failure. A failed job prints nothing. Temporary files created for rendering are removed whether the job succeeds or fails.
