// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 KIM Hyunjae

/**
 * @fileoverview The print flow's policy, with CUPS replaced: copy limit, page confirmation, JIS
 * size resolution and failure reporting. No printer or Chrome is involved.
 */

import { beforeEach, describe, expect, it, vi } from "bun:test"
import { join } from "node:path"

const fixtures = join(import.meta.dir, "../fixtures")

const config = {
  allowedPaths: [fixtures],
  deniedPaths: [],
  autoRenderMarkdown: true,
  autoRenderCode: true,
  defaultPrinter: "",
  defaultOptions: [] as string[],
  maxCopies: 10,
  confirmIfOverPages: 10,
}
vi.mock("../../src/config.js", () => ({ config, MARKDOWN_EXTENSIONS: ["md", "markdown"] }))

const submitJob = vi.fn(async (_job: unknown) => undefined)
const readPrinterOptions = vi.fn(
  async (_printer?: string): Promise<Record<string, unknown> | null> => null
)
const getDefaultPrinter = vi.fn(async (): Promise<string | undefined> => "office")
vi.mock("../../src/cups.js", () => ({
  submitJob,
  readPrinterOptions,
  getDefaultPrinter,
}))

import { handlePrint, handlePrintPdf } from "../../src/tools/batch-helpers.js"

const NOTES = join(fixtures, "notes.txt")

/** A valid PDF with the given number of blank pages. */
function pdfBase64(pages: number): string {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${Array.from({ length: pages }, (_, i) => `${3 + i} 0 R`).join(" ")}] /Count ${pages} >>`,
    ...Array.from(
      { length: pages },
      () => "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>"
    ),
  ]
  let out = "%PDF-1.4\n"
  const offsets = objects.map((object, i) => {
    const offset = out.length
    out += `${i + 1} 0 obj\n${object}\nendobj\n`
    return offset
  })
  const xrefOffset = out.length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  out += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  return Buffer.from(out, "latin1").toString("base64")
}

const submitted = () => submitJob.mock.calls.map((call) => call[0] as { options: string[] })

beforeEach(() => {
  submitJob.mockReset()
  submitJob.mockResolvedValue(undefined)
  readPrinterOptions.mockReset()
  readPrinterOptions.mockResolvedValue(null)
  getDefaultPrinter.mockReset()
  getDefaultPrinter.mockResolvedValue("office")
  config.defaultOptions = []
  config.maxCopies = 10
  config.confirmIfOverPages = 10
})

describe("copy limit", () => {
  it("fails a job over the limit without sending it and names the limit", async () => {
    const result = await handlePrint({ file_path: NOTES, copies: 11 })

    expect(result.success).toBe(false)
    expect(result.error).toContain("10")
    expect(submitJob).not.toHaveBeenCalled()
  })

  it("lets a job at the limit through, and any count when the limit is 0", async () => {
    expect((await handlePrint({ file_path: NOTES, copies: 10 })).success).toBe(true)
    config.maxCopies = 0
    expect((await handlePrint({ file_path: NOTES, copies: 500 })).success).toBe(true)
  })
})

describe("failure reporting", () => {
  it("reports a rejected job as a failed result instead of throwing", async () => {
    submitJob.mockRejectedValue(new Error("lpr: Not authorized"))

    const result = await handlePrint({ file_path: NOTES })

    expect(result.success).toBe(false)
    expect(result.error).toContain("Not authorized")
  })

  it("still reports success for a job that CUPS accepted when the printer name lookup fails", async () => {
    getDefaultPrinter.mockRejectedValue(new Error("Command failed: timed out"))

    const result = await handlePrint({ file_path: NOTES })

    expect(result.success).toBe(true)
    expect(submitJob).toHaveBeenCalledTimes(1)
  })

  it("reports a path outside the allowed directories as a failed result", async () => {
    const result = await handlePrint({ file_path: "/etc/hostname" })

    expect(result.success).toBe(false)
    expect(submitJob).not.toHaveBeenCalled()
  })
})

describe("JIS sizes", () => {
  const options = (pageSize: string[]) => ({ PageSize: { choices: pageSize } })

  it("sends a custom size to a printer that lacks the size", async () => {
    readPrinterOptions.mockResolvedValue(options(["A4", "Custom.WIDTHxHEIGHT"]))

    await handlePrint({ file_path: NOTES, printer: "athena", media: "jis_b5_182x257mm" })

    expect(submitted()[0]?.options).toContain("media=Custom.182x257mm")
  })

  it("sends the printer's own choice when it lists the size", async () => {
    readPrinterOptions.mockResolvedValue(options(["A4", "JISB5"]))

    await handlePrint({ file_path: NOTES, printer: "pdf", media: "jis_b5_182x257mm" })

    expect(submitted()[0]?.options).toContain("media=JISB5")
  })

  it("sends the name unchanged when the printer's options cannot be read", async () => {
    await handlePrint({ file_path: NOTES, printer: "athena", media: "jis_b6_128x182mm" })

    expect(submitted()[0]?.options).toContain("media=jis_b6_128x182mm")
  })

  it("does not read printer options for other sizes", async () => {
    await handlePrint({ file_path: NOTES, printer: "athena", media: "A4" })

    expect(readPrinterOptions).not.toHaveBeenCalled()
    expect(submitted()[0]?.options).toContain("media=A4")
  })
})

describe("page confirmation", () => {
  const eleven = pdfBase64(11)

  it("holds a job over the threshold until the caller confirms", async () => {
    const held = await handlePrintPdf({ pdf_base64: eleven })

    expect(held.success).toBe(false)
    expect(held.error).toBe("PAGE_COUNT_CONFIRMATION_REQUIRED")
    expect(submitJob).not.toHaveBeenCalled()

    const confirmed = await handlePrintPdf({ pdf_base64: eleven, skip_confirmation: true })
    expect(confirmed.success).toBe(true)
  })

  it("counts duplex sheets from the sides setting", async () => {
    expect(
      (await handlePrintPdf({ pdf_base64: eleven, sides: "two-sided-long-edge" })).success
    ).toBe(true)
  })

  it("applies the threshold to one-sided jobs even when two-sided is the default", async () => {
    config.defaultOptions = ["sides=two-sided-long-edge"]

    expect((await handlePrintPdf({ pdf_base64: eleven })).success).toBe(true)
    const oneSided = await handlePrintPdf({ pdf_base64: eleven, sides: "one-sided" })

    expect(oneSided.error).toBe("PAGE_COUNT_CONFIRMATION_REQUIRED")
  })

  it("does not check when the threshold is 0", async () => {
    config.confirmIfOverPages = 0

    expect((await handlePrintPdf({ pdf_base64: eleven })).success).toBe(true)
  })
})
