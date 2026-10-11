# Printer management

## Queries

These tools are always available and change nothing.

- `list_printers`: the CUPS queues with their state, the default destination, and the print settings each queue accepts ([print-settings](print-settings.md)). It reports that no printers were found when there are none.
- `get_default_printer`: the CUPS default printer, or a statement that none is set.
- `get_print_queue`: the pending and active jobs, for the named `printer` or for all printers; a statement that the queue is empty when it is.
- `get_config`: the effective value of each [configuration](configuration.md) variable.

`MCP_PRINTER_DEFAULT_PRINTER` only chooses the queue for print calls without `printer`. It is separate from the CUPS default printer that `get_default_printer` reports.

## Changes

These tools exist only when `MCP_PRINTER_ENABLE_MANAGEMENT` is `true`, because they act on state beyond the caller's own jobs.

- `cancel_print_job`: takes a `jobs` array ([batches](batches.md)). Each entry is either a `job_id` (with `printer` to name the queue) or `cancel_all: true` with the `printer` whose jobs to cancel. Any other combination fails that entry. CUPS decides whether the server's user may cancel a job, so jobs of other users are cancelled where CUPS permits.
- `set_default_printer`: sets the CUPS default printer for the user the server runs as.
