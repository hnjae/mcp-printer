# Specification

External behavior of the MCP Printer server: what a client, an operator, or a user can rely on. Each file covers one subject and describes the intended behavior; where the code differs, the code is wrong.

- [transports](transports.md): stdio and Streamable HTTP, and what the HTTP endpoint accepts.
- [tool-availability](tool-availability.md): which tools and prompts are registered under which configuration.
- [printing](printing.md): `print_content`, `print_pdf` and `print_file`.
- [print-settings](print-settings.md): `sides`, `media`, `orientation`, `quality` and `options`, their precedence, JIS B5/B6, and the per-printer values `list_printers` reports.
- [page-confirmation](page-confirmation.md): the sheet threshold, `skip_confirmation`, and `get_page_meta`.
- [batches](batches.md): array parameters, the batch size limit, and per-item failure.
- [file-access](file-access.md): which server paths file tools may read.
- [untrusted-content](untrusted-content.md): what `print_content` strips from client-supplied HTML and Markdown.
- [rendering](rendering.md): when files are rendered to PDF, and how.
- [printer-management](printer-management.md): printer, queue and configuration queries, job cancellation, and the CUPS default printer.
- [prompts](prompts.md): the `print-changed` prompt.
- [configuration](configuration.md): every environment variable.
