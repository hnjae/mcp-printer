// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 KIM Hyunjae

/**
 * @fileoverview withPreparedContent: client-supplied content becomes a printable file and every
 * temporary file is removed afterwards. Nothing here sends a job to a printer.
 */

import { describe, expect, it, vi } from "bun:test"
import { existsSync, readFileSync } from "node:fs"

// Mocks registered by other integration files persist for the whole run, so pin the config this file needs
vi.mock("../../src/config.ts", () => ({
  config: {
    allowedPaths: [],
    deniedPaths: [],
    autoRenderMarkdown: true,
    chromePath: "",
    code: {
      colorScheme: "atom-one-light",
      autoLineNumbers: true,
      fontSize: "10pt",
      lineSpacing: "1.5",
    },
  },
  MARKDOWN_EXTENSIONS: ["md", "markdown"],
}))

import { withPreparedContent } from "../../src/utils.ts"
import { A4, B5, firstPageSize, isSize, LETTER } from "../helpers/pdf-page-size.ts"
import { pageSizeForMedia } from "../../src/page-size.ts"

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

  describe("page size", () => {
    async function pageSize(options: Parameters<typeof withPreparedContent>[0]) {
      let size = { width: 0, height: 0 }
      await withPreparedContent(options, async (prepared) => {
        size = firstPageSize(prepared.actualFilePath)
      })
      return size
    }

    const formats = [
      { content: "# Title", format: "markdown" as const },
      { content: "<p>Body</p>", format: "html" as const },
      { content: "const x = 1", format: "code" as const, language: "ts" },
      { content: "plain", format: "text" as const },
    ]

    it("renders every format on A4 unless told otherwise", async () => {
      for (const options of formats) {
        expect(isSize(await pageSize(options), A4)).toBe(true)
      }
    })

    it("renders every format on the requested page size", async () => {
      for (const options of formats) {
        const size = await pageSize({ ...options, pageSize: pageSizeForMedia("jis_b5_182x257mm") })
        expect(isSize(size, B5)).toBe(true)
      }
    })

    it("lets HTML choose its own page size", async () => {
      const size = await pageSize({
        content: "<style>@page { size: letter }</style><p>Body</p>",
        format: "html",
      })

      expect(isSize(size, LETTER)).toBe(true)
    })
  })
})
