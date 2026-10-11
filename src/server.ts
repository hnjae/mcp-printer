// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 Steve CLARKE
// SPDX-FileCopyrightText: 2026 KIM Hyunjae

/**
 * @fileoverview MCP Server implementation for printing operations.
 * Provides a Model Context Protocol server that exposes printing tools via CUPS.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { config } from "./config.ts"
import { startHttpServer } from "./http.ts"
import { createMcpServer } from "./mcp-server.ts"

/**
 * Starts the MCP Printer server on the configured transport (stdio by default,
 * or Streamable HTTP when MCP_PRINTER_TRANSPORT=http).
 *
 * @throws {Error} If server connection fails or unsupported OS detected
 */
export async function startServer() {
  // Check for unsupported operating systems
  if (process.platform === "win32") {
    throw new Error(
      "MCP Printer is not supported on Windows. " +
        "This server requires CUPS printing system, which is only available on macOS and Linux. " +
        "Windows uses a different printing architecture that is not currently supported."
    )
  }

  // Log platform information
  console.error(`MCP Printer Server starting on ${process.platform}...`)

  if (config.transport === "http") {
    await startHttpServer({ hostname: config.httpHost, port: config.httpPort })
    console.error(`MCP Printer Server running on http://${config.httpHost}:${config.httpPort}/mcp`)
    return
  }

  await createMcpServer().connect(new StdioServerTransport())
  console.error("MCP Printer Server running on stdio")
}
