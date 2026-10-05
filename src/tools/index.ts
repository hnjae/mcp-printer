// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 Steve CLARKE
// SPDX-FileCopyrightText: 2026 KIM Hyunjae

/**
 * @fileoverview Central tool registry.
 * Registers all MCP tools and prompts with the server instance.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { config } from "../config.js"
import { registerPrintTools } from "./print.js"
import { registerPrinterTools } from "./printer.js"
import { registerPrompts } from "./prompts.js"

/**
 * Registers all available MCP tools and prompts with the given server.
 * Includes printer management tools, file printing, markdown rendering, and workflow prompts.
 * Write operations (set_default_printer, cancel_print_job) are conditionally
 * registered based on the MCP_PRINTER_ENABLE_MANAGEMENT configuration.
 * Prompts are conditionally registered based on the MCP_PRINTER_ENABLE_PROMPTS configuration.
 *
 * @param server - The McpServer instance to register tools and prompts with
 */
export function registerAllTools(server: McpServer) {
  registerPrinterTools(server)
  registerPrintTools(server)
  if (config.enablePrompts) {
    registerPrompts(server)
  }
}
