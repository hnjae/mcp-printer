# Transports

The server speaks MCP over stdio or Streamable HTTP. `MCP_PRINTER_TRANSPORT` selects one: `stdio` (default) or `http`. The server starts only on macOS and Linux and refuses to start on Windows. Log output goes to stderr in both modes; with stdio, stdout carries only the protocol.

## HTTP

The server listens on `MCP_PRINTER_HTTP_HOST:MCP_PRINTER_HTTP_PORT` (default `127.0.0.1:3000`) and serves MCP at `/mcp`.

- `POST /mcp` handles an MCP request and answers with a JSON body. Each request is served independently: there are no sessions and no server-to-client event stream.
- Any other method on `/mcp` is answered with `405` and `Allow: POST`.
- Any other path is answered with `404`.
- An unexpected failure while handling a request is answered with `500` and a JSON-RPC internal error (`-32603`).

The HTTP transport has no authentication or encryption. Every client that can reach the listener can invoke every registered tool, including printing and, when enabled, job cancellation. Operators restrict access with the bind address or an authenticating proxy.
