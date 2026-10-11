// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 KIM Hyunjae

/**
 * @fileoverview withPreparedPdf: a base64 PDF from the client is validated, written to a private
 * temporary file and removed afterwards. Nothing here sends a job to a printer.
 */

import { describe, expect, it, vi } from "bun:test"
import { existsSync, readFileSync, rmSync } from "node:fs"
import { dirname } from "node:path"

// Mocks registered by other integration files persist for the whole run, so pin the config this file needs
vi.mock("../../src/config.ts", () => ({
  config: {
    allowedPaths: [],
    deniedPaths: [],
    chromePath: "",
    chromeNoSandbox: false,
  },
  MARKDOWN_EXTENSIONS: ["md", "markdown"],
}))

import { convertHtmlToPdf, MAX_PDF_BYTES, withPreparedPdf } from "../../src/utils.ts"

async function samplePdfBase64(): Promise<string> {
  const pdf = await convertHtmlToPdf("<h1>Sample</h1>")
  try {
    return readFileSync(pdf).toString("base64")
  } finally {
    rmSync(dirname(pdf), { recursive: true, force: true })
  }
}

describe("withPreparedPdf", () => {
  it("hands a valid PDF to the caller and removes it afterwards", async () => {
    const base64 = await samplePdfBase64()
    let path = ""
    let header = ""

    await withPreparedPdf(base64, async (prepared) => {
      path = prepared.actualFilePath
      header = readFileSync(path).subarray(0, 5).toString("latin1")
    })

    expect(header).toBe("%PDF-")
    expect(existsSync(path)).toBe(false)
  })

  it("rejects data that is not a PDF", async () => {
    const notPdf = Buffer.from("just some text").toString("base64")

    await expect(withPreparedPdf(notPdf, async () => undefined)).rejects.toThrow(/PDF/)
  })

  it("rejects a PDF whose page count cannot be read", async () => {
    const truncated = Buffer.from("%PDF-1.7\nnot really a document").toString("base64")

    await expect(withPreparedPdf(truncated, async () => undefined)).rejects.toThrow(/PDF/)
  })

  it("rejects a PDF over the size limit", async () => {
    const oversized = Buffer.concat([
      Buffer.from("%PDF-1.7\n"),
      Buffer.alloc(MAX_PDF_BYTES),
    ]).toString("base64")

    await expect(withPreparedPdf(oversized, async () => undefined)).rejects.toThrow(/limit|large/i)
  })

  it("removes the temporary file when the caller fails", async () => {
    const base64 = await samplePdfBase64()
    let path = ""

    const attempt = withPreparedPdf(base64, async (prepared) => {
      path = prepared.actualFilePath
      throw new Error("printer unavailable")
    })

    await expect(attempt).rejects.toThrow("printer unavailable")
    expect(existsSync(path)).toBe(false)
  })
})
