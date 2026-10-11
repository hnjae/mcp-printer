# Print settings

Every print tool takes the same settings. The typed ones have values a client can choose from the tool schema; `options` carries anything else.

| Parameter | Values | Sent to CUPS as |
| --- | --- | --- |
| `sides` | `one-sided`, `two-sided-long-edge`, `two-sided-short-edge` | `sides=<value>` |
| `media` | Paper size without whitespace or `=`, such as `A4` | `media=<value>` |
| `orientation` | `portrait`, `landscape` | `orientation-requested=3` or `4` |
| `quality` | `draft`, `normal`, `high` | `cupsPrintQuality=Draft`, `Normal` or `High` |
| `options` | Space-separated CUPS options, such as `number-up=2` | Passed through |

Which values a printer accepts depends on the printer; [list_printers](#values-reported-per-printer) reports them. A value the printer does not support is not rejected by the server; CUPS ignores or rejects it.

## Precedence

The options of a job are assembled in this order, and when an option name occurs more than once the last occurrence wins:

1. `sides=two-sided-long-edge`, if `MCP_PRINTER_AUTO_DUPLEX` is `true`.
2. `MCP_PRINTER_DEFAULT_OPTIONS`.
3. The call's `options`.
4. The call's `sides`, `media`, `orientation` and `quality`.

So a typed setting always overrides the same setting from the other sources. A typed `orientation` also removes `landscape` and a typed `quality` also removes `print-quality` from the defaults and `options`, because CUPS treats those as separate keys that order alone cannot override.

The effective `sides` value decides whether a job counts as duplex for [page-confirmation](page-confirmation.md). `get_page_meta` accepts `sides` and `options` for that purpose only.

## Custom sizes

A printer whose `list_printers` entry mentions `Custom.<W>x<H>mm` accepts any size in millimetres in that form, such as `Custom.182x257mm`.

## JIS B5 and B6

The names `jis_b5_182x257mm` (182 × 257 mm) and `jis_b6_128x182mm` (128 × 182 mm) are valid `media` values on every printer where `list_printers` shows them. A client cannot tell whether the printer lists the size itself, and does not need to.

`list_printers` shows a size when the printer lists it itself, or when it lists A4 (for B5) or A5 (for B6) and custom page sizes. A size the printer lists itself, whatever its own name for it (`JISB5`, `182x257mm`), is shown once under the name above.

When a job asks for one of these names, the server reads the target printer's page sizes and sends the printer's own choice for the size if it has one, otherwise `Custom.<W>x<H>mm`. If the printer's page sizes cannot be read, or the printer has neither, the name is sent unchanged. Whether a printer feeds and prints a custom size depends on the printer.

Any other `media` value is sent unchanged, including a printer's own names such as `JISB5`.

## Values reported per printer

`list_printers` reports, for every CUPS queue, the values the tools accept:

- `sides`: the printer's supported duplex modes in the values above, with the default marked. A printer without a duplex option reports `one-sided` only.
- `media`: the printer's page sizes with the default marked, JIS sizes under the names above, and a note when custom sizes are accepted.
- `quality`: `draft`, `normal` and `high` as the printer supports them, with the default marked, or a statement that it is not supported.

A queue whose options cannot be read, or cannot be read within a bounded time, is reported as unavailable without affecting the other queues.
