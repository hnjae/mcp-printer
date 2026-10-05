#!/usr/bin/env bun
// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 Steve CLARKE
// SPDX-FileCopyrightText: 2026 KIM Hyunjae

/**
 * @fileoverview Entry point for the MCP Printer server.
 * Starts the Model Context Protocol server for printing operations via CUPS.
 */

import { startServer } from "./server.js"

// Start the MCP Printer server
startServer().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
