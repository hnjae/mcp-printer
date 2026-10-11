// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 KIM Hyunjae

/**
 * @fileoverview Unit tests for the CUPS access module.
 */

import { beforeEach, describe, expect, it, vi } from "bun:test"
import {
  cancelAllJobs,
  cancelJob,
  getDefaultPrinter,
  parseLpoptions,
  setDefaultPrinter,
  submitJob,
} from "../../src/cups.js"

const execa = vi.fn(async (..._args: unknown[]) => ({ stdout: "" }))
vi.mock("execa", () => ({ execa }))

beforeEach(() => execa.mockClear())

// Trimmed `lpoptions -p <name> -l` output from an inkjet IPP queue.
const INKJET = `PageSize/Media Size: 215x345mm 4x6 *A4 A4.Borderless A5 A6 Letter Custom.WIDTHxHEIGHT
Duplex/Duplex: None *DuplexNoTumble DuplexTumble
`

describe("parseLpoptions", () => {
  it("reads choices and the default of each option", () => {
    const options = parseLpoptions(INKJET)
    expect(options.PageSize?.default).toBe("A4")
    expect(options.PageSize?.choices).toContain("Custom.WIDTHxHEIGHT")
    expect(options.Duplex).toEqual({
      choices: ["None", "DuplexNoTumble", "DuplexTumble"],
      default: "DuplexNoTumble",
    })
  })

  it("splits on the last colon so UI text containing one does not leak into choices", () => {
    expect(
      parseLpoptions("Duplex/Two-sided: printing: None *DuplexTumble").Duplex?.choices
    ).toEqual(["None", "DuplexTumble"])
  })

  it("returns nothing for empty or unrelated output", () => {
    expect(parseLpoptions("")).toEqual({})
    expect(parseLpoptions("lpoptions: Unable to get PPD file")).toEqual({})
  })
})

describe("submitJob", () => {
  it("sends the printer, copies, options and file to lpr", async () => {
    await submitJob({
      file: "/tmp/a.pdf",
      printer: "athena",
      copies: 3,
      options: ["sides=one-sided", "media=A4"],
    })
    expect(execa.mock.calls[0]?.slice(0, 2)).toEqual([
      "lpr",
      ["-P", "athena", "-#3", "-o", "sides=one-sided", "-o", "media=A4", "/tmp/a.pdf"],
    ])
  })

  it("leaves out the printer and the copy count when they are not needed", async () => {
    await submitJob({ file: "/tmp/a.pdf", copies: 1, options: [] })
    expect(execa.mock.calls[0]?.slice(0, 2)).toEqual(["lpr", ["/tmp/a.pdf"]])
  })
})

describe("changes to CUPS state", () => {
  it("cancels one job, naming the queue when it is known", async () => {
    await cancelJob("42", "athena")
    await cancelJob("43")
    expect(execa.mock.calls.map((call) => call.slice(0, 2))).toEqual([
      ["lprm", ["-P", "athena", "42"]],
      ["lprm", ["43"]],
    ])
  })

  it("cancels every job on a queue", async () => {
    await cancelAllJobs("athena")
    expect(execa.mock.calls[0]?.slice(0, 2)).toEqual(["lprm", ["-P", "athena", "-"]])
  })

  it("sets the default printer", async () => {
    await setDefaultPrinter("athena")
    expect(execa.mock.calls[0]?.slice(0, 2)).toEqual(["lpoptions", ["-d", "athena"]])
  })

  it("lets a CUPS failure reach the caller", async () => {
    execa.mockRejectedValueOnce(new Error("lprm: not authorized"))
    await expect(cancelJob("42")).rejects.toThrow("not authorized")
  })
})

describe("getDefaultPrinter", () => {
  it("reads the name from the default destination line", async () => {
    execa.mockResolvedValueOnce({ stdout: "system default destination: athena" })
    expect(await getDefaultPrinter()).toBe("athena")
  })

  it("returns undefined when no default is set", async () => {
    execa.mockResolvedValueOnce({ stdout: "no system default destination" })
    expect(await getDefaultPrinter()).toBeUndefined()
  })

  it("asks for untranslated output, which the parser depends on", async () => {
    execa.mockResolvedValueOnce({ stdout: "system default destination: athena" })
    await getDefaultPrinter()
    const options = execa.mock.calls[0]?.[2] as { env?: Record<string, string> }
    expect(options.env?.LC_ALL).toBe("C.UTF-8")
  })
})
