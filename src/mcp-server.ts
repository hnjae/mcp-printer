// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 KIM Hyunjae

/**
 * @fileoverview MCP server instance factory shared by all transports.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import packageJson from "../package.json" with { type: "json" }
import { registerAllTools } from "./tools/index.ts"

/**
 * Creates an MCP server instance for printing via CUPS.
 * Handles printer management, print jobs, and document rendering.
 * Stateless HTTP serving creates one instance per request.
 */
export function createMcpServer(): McpServer {
  const mcpServer = new McpServer({
    name: "mcp-printer",
    version: packageJson.version,
  })
  registerAllTools(mcpServer)
  return mcpServer
}
