# Page confirmation

A job that would use many sheets of paper is held for the user's approval before it prints.

## The check

Before a job is sent to CUPS, the server counts the pages of the PDF that would be printed, after any rendering. A job with duplex printing uses half as many sheets as pages, rounded up; otherwise one sheet per page. Duplex follows the effective `sides` setting described in [print-settings](print-settings.md). Copies are not multiplied in.

If the sheet count is greater than `MCP_PRINTER_CONFIRM_IF_OVER_PAGES` (default 10; `0` disables the check), the job is not printed. Its result fails with the code `PAGE_COUNT_CONFIRMATION_REQUIRED` and states the page and sheet counts. The client is expected to ask the user, and repeat the call with `skip_confirmation: true` only if the user agrees. A job at or below the threshold prints without confirmation.

The check applies to `print_content`, `print_pdf` and `print_file`. It does not apply to documents whose page count cannot be read, such as plain text or images sent to CUPS unchanged; those print without a check.

## get_page_meta

`get_page_meta` takes a `files` array with the same file, rendering and `sides`/`options` parameters as `print_file`, and prints nothing. For each file it returns the page count, the sheet count and whether duplex was assumed. Markdown and code files are rendered first, as for printing. A file that is not a PDF and cannot be rendered to one fails. It is available when file tools are enabled.
