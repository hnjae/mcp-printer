// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 KIM Hyunjae

/**
 * @fileoverview Contract tests for the Streamable HTTP transport.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test"
import type { AddressInfo } from "node:net"
import { config } from "../../src/config.ts"
import { startHttpServer } from "../../src/http.ts"

const MCP_HEADERS = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
}

let server: Awaited<ReturnType<typeof startHttpServer>>
let baseUrl: string

beforeAll(async () => {
  // Other test files mock the config module, so state the precondition explicitly
  config.enableFileTools = true
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

describe("file tools switch", () => {
  afterEach(() => {
    config.enableFileTools = true
  })

  async function listNames(method: "tools/list" | "prompts/list") {
    const body = await (await rpc(method)).json()
    // With no prompts registered the server does not offer prompts/list at all
    const items = body.result?.tools ?? body.result?.prompts ?? []
    return items.map((item: { name: string }) => item.name)
  }

  it("hides path-based tools and their prompt when disabled", async () => {
    config.enableFileTools = false

    const tools = await listNames("tools/list")
    expect(tools).toContain("print_content")
    expect(tools).toContain("print_pdf")
    expect(tools).toContain("list_printers")
    expect(tools).not.toContain("print_file")
    expect(tools).not.toContain("get_page_meta")
    expect(await listNames("prompts/list")).not.toContain("print-changed")
  })

  it("offers path-based tools when enabled", async () => {
    config.enableFileTools = true

    const tools = await listNames("tools/list")
    expect(tools).toContain("print_file")
    expect(tools).toContain("get_page_meta")
  })
})
