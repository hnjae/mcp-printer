# Tool availability

Tools and prompts are registered when the server starts, so a disabled one is absent from the client's list. Changing the configuration takes effect after a restart.

| Registered | Condition |
| --- | --- |
| `print_content`, `print_pdf`, `list_printers`, `get_default_printer`, `get_print_queue`, `get_config` | Always |
| `print_file`, `get_page_meta` | `MCP_PRINTER_ENABLE_FILE_TOOLS` is `true` (default) |
| `cancel_print_job`, `set_default_printer` | `MCP_PRINTER_ENABLE_MANAGEMENT` is `true` (default `false`) |
| Prompt `print-changed` | `MCP_PRINTER_ENABLE_PROMPTS` is `true` (default) and file tools are enabled |

Printing from client-supplied content (`print_content`, `print_pdf`) is available in every configuration. Tools that read paths on the server exist only when file tools are enabled, and tools that change CUPS state or other users' jobs only when management is enabled.
