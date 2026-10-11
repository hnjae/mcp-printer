// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 KIM Hyunjae

/**
 * @fileoverview Streamable HTTP transport for the MCP Printer server.
 * Stateless: every request gets its own server and transport, and replies with plain JSON.
 * There is no authentication here; expose the port only to a trusted auth proxy.
 */

import { createServer, type Server } from "node:http"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { createMcpServer } from "./mcp-server.ts"

const MCP_PATH = "/mcp"

/**
 * Starts the HTTP server exposing MCP at POST /mcp.
 *
 * @param options.hostname - Interface to bind to
 * @param options.port - Port to listen on (0 picks a free port)
 * @returns The listening Node HTTP server
 */
export function startHttpServer(options: { hostname: string; port: number }): Promise<Server> {
  const httpServer = createServer(async (req, res) => {
    if (new URL(req.url ?? "/", "http://localhost").pathname !== MCP_PATH) {
      res.writeHead(404).end("Not found")
      return
    }
    if (req.method !== "POST") {
      res.writeHead(405, { allow: "POST" }).end("Method not allowed")
      return
    }

    const server = createMcpServer()
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    })
    res.on("close", () => {
      void transport.close()
      void server.close()
    })

    try {
      await server.connect(transport)
      await transport.handleRequest(req, res)
    } catch (error) {
      console.error("Error handling MCP request:", error)
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "application/json" }).end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32603, message: "Internal server error" },
            id: null,
          })
        )
      }
    }
  })

  return new Promise((resolve, reject) => {
    httpServer.once("error", reject)
    httpServer.listen(options.port, options.hostname, () => resolve(httpServer))
  })
}
