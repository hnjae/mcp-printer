// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 KIM Hyunjae

/**
 * @fileoverview withPreparedContent: client-supplied content becomes a printable file and every
 * temporary file is removed afterwards. Nothing here sends a job to a printer.
 */

import { describe, expect, it, vi } from "bun:test"
import { existsSync, readFileSync } from "node:fs"

// Mocks registered by other integration files persist for the whole run, so pin the config this file needs
vi.mock("../../src/config.js", () => ({
  config: {
    allowedPaths: [],
    deniedPaths: [],
    autoRenderMarkdown: true,
    chromePath: "",
    code: {
      excludeExtensions: [],
      colorScheme: "atom-one-light",
      autoLineNumbers: true,
      fontSize: "10pt",
      lineSpacing: "1.5",
    },
  },
  MARKDOWN_EXTENSIONS: ["md", "markdown"],
}))

import { withPreparedContent } from "../../src/utils.js"

async function prepare(options: Parameters<typeof withPreparedContent>[0]) {
  let path = ""
  let renderType = ""
  let header = ""
  let existedInside = false
  await withPreparedContent(options, async (prepared) => {
    path = prepared.actualFilePath
    renderType = prepared.renderType
    existedInside = existsSync(path)
    header = readFileSync(path).subarray(0, 5).toString("latin1")
  })
  return { path, renderType, header, existedInside, existsAfter: existsSync(path) }
}

describe("withPreparedContent", () => {
  it("renders markdown to a PDF and cleans up", async () => {
    const result = await prepare({
      content: "# Title\n\n| a | b |\n|---|---|\n| 1 | 2 |\n",
      format: "markdown",
    })

    expect(result.existedInside).toBe(true)
    expect(result.header).toBe("%PDF-")
    expect(result.existsAfter).toBe(false)
  })

  it("renders html to a PDF and cleans up", async () => {
    const result = await prepare({ content: "<h1>Title</h1><p>Body</p>", format: "html" })

    expect(result.existedInside).toBe(true)
    expect(result.header).toBe("%PDF-")
    expect(result.existsAfter).toBe(false)
  })

  it("renders code to a PDF and cleans up", async () => {
    const result = await prepare({ content: "print('hi')\n", format: "code", language: "py" })

    expect(result.existedInside).toBe(true)
    expect(result.header).toBe("%PDF-")
    expect(result.existsAfter).toBe(false)
  })

  it("renders text to a PDF and cleans up", async () => {
    const result = await prepare({ content: "plain <b>words</b>\n", format: "text" })

    expect(result.existedInside).toBe(true)
    expect(result.header).toBe("%PDF-")
    expect(result.existsAfter).toBe(false)
  })

  it("rejects a language that is not a plain extension", async () => {
    const attempt = withPreparedContent(
      { content: "x", format: "code", language: "../../etc/evil" },
      async () => undefined
    )

    await expect(attempt).rejects.toThrow(/language/i)
  })

  it("removes temporary files when the caller fails", async () => {
    let path = ""
    const attempt = withPreparedContent(
      { content: "plain\n", format: "text" },
      async (prepared) => {
        path = prepared.actualFilePath
        throw new Error("printer unavailable")
      }
    )

    await expect(attempt).rejects.toThrow("printer unavailable")
    expect(existsSync(path)).toBe(false)
  })
})
