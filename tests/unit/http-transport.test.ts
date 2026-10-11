// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 KIM Hyunjae

/**
 * @fileoverview Contract tests for the Streamable HTTP transport.
 */

import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import type { AddressInfo } from "node:net"
import { startHttpServer } from "../../src/http.js"

const MCP_HEADERS = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
}

let server: Awaited<ReturnType<typeof startHttpServer>>
let baseUrl: string

beforeAll(async () => {
  server = await startHttpServer({ hostname: "127.0.0.1", port: 0 })
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/mcp`
})

afterAll(() => {
  server.close()
})

function rpc(method: string, params: Record<string, unknown> = {}, id = 1) {
  return fetch(baseUrl, {
    method: "POST",
    headers: MCP_HEADERS,
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  })
}

describe("HTTP transport", () => {
  it("answers initialize without requiring a session", async () => {
    const response = await rpc("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "test", version: "0.0.0" },
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.result.serverInfo.name).toBe("mcp-printer")
  })

  it("lists tools in a standalone request", async () => {
    const response = await rpc("tools/list")

    expect(response.status).toBe(200)
    const body = await response.json()
    const names = body.result.tools.map((tool: { name: string }) => tool.name)
    expect(names).toContain("print_file")
    expect(names).toContain("list_printers")
    expect(names).toContain("print_content")
    expect(names).toContain("print_pdf")
  })

  it("rejects GET and DELETE on /mcp with 405", async () => {
    expect((await fetch(baseUrl, { method: "GET", headers: MCP_HEADERS })).status).toBe(405)
    expect((await fetch(baseUrl, { method: "DELETE", headers: MCP_HEADERS })).status).toBe(405)
  })

  it("returns 404 for other paths", async () => {
    const response = await fetch(baseUrl.replace("/mcp", "/other"), {
      method: "POST",
      headers: MCP_HEADERS,
      body: "{}",
    })

    expect(response.status).toBe(404)
  })
})
