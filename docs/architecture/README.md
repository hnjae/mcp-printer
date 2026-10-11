# Architecture

Durable structural constraints of the MCP Printer server: ownership, dependency direction, and failure semantics. They describe the intended end state and leave mechanisms to the implementation. External behavior is in [docs/spec](../spec/README.md).

- [cups-access](cups-access.md): CUPS is reached through one module.
