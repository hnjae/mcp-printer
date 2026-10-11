// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 KIM Hyunjae

/**
 * @fileoverview Unit tests for per-printer print settings and JIS size handling.
 */

import { describe, expect, it, vi } from "bun:test"
import {
  describePrinterSettings,
  formatPrinterSettings,
  parseLpoptions,
  resolveMedia,
} from "../../src/print-settings.js"
import { buildCupsOptions } from "../../src/utils.js"

vi.mock("../../src/config.js", () => ({ config: { autoDuplex: false, defaultOptions: [] } }))

// Trimmed `lpoptions -p <name> -l` output from an inkjet IPP queue and a cups-pdf queue.
const INKJET = `PageSize/Media Size: 215x345mm 4x6 *A4 A4.Borderless A5 A6 Letter Custom.WIDTHxHEIGHT
InputSlot/Media Source: *Auto Main
cupsPrintQuality/cupsPrintQuality: Draft *Normal High
ColorModel/Output Mode: *RGB Gray
Duplex/Duplex: None *DuplexNoTumble DuplexTumble
OutputBin/OutputBin: *FaceUp
`
const CUPS_PDF = `PageSize/Page Size: Custom.WIDTHxHEIGHT A3 *A4 A5 ISOB5 JISB4 JISB5 Letter
Resolution/Output Resolution: 150dpi *300dpi 600dpi
`
const values = (list: { value: string }[]) => list.map(({ value }) => value)

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

describe("describePrinterSettings", () => {
  it("translates Duplex and cupsPrintQuality into tool parameter values", () => {
    const settings = describePrinterSettings(parseLpoptions(INKJET))
    expect(settings.sides).toEqual([
      { value: "one-sided", isDefault: false },
      { value: "two-sided-long-edge", isDefault: true },
      { value: "two-sided-short-edge", isDefault: false },
    ])
    expect(values(settings.quality)).toEqual(["draft", "normal", "high"])
    expect(settings.quality.find((q) => q.isDefault)?.value).toBe("normal")
  })

  it("reports one-sided only and no quality when the PPD lacks those options", () => {
    const settings = describePrinterSettings(parseLpoptions(CUPS_PDF))
    expect(settings.sides).toEqual([{ value: "one-sided", isDefault: true }])
    expect(settings.quality).toEqual([])
  })

  it("adds JIS-B5 and JIS-B6 when A4 and A5 and custom sizes are available", () => {
    const media = values(describePrinterSettings(parseLpoptions(INKJET)).media)
    expect(media).toContain("JIS-B5")
    expect(media).toContain("JIS-B6")
    expect(media).not.toContain("Custom.WIDTHxHEIGHT")
  })

  it("adds a JIS size only when its own A-series size is listed", () => {
    const media = values(
      describePrinterSettings(parseLpoptions("PageSize/x: *A4 Custom.WIDTHxHEIGHT")).media
    )
    expect(media).toContain("JIS-B5")
    expect(media).not.toContain("JIS-B6")
  })

  it("adds no JIS size without custom size support", () => {
    const media = values(describePrinterSettings(parseLpoptions("PageSize/x: *A4 A5")).media)
    expect(media).not.toContain("JIS-B5")
    expect(media).not.toContain("JIS-B6")
  })

  it("does not duplicate a size the printer lists natively", () => {
    const media = values(describePrinterSettings(parseLpoptions(CUPS_PDF)).media)
    expect(media).toContain("JISB5")
    expect(media).not.toContain("JIS-B5")
    expect(media).toContain("JIS-B6")
  })

  it("lists nothing for a printer without page sizes", () => {
    const settings = describePrinterSettings({})
    expect(settings.media).toEqual([])
    expect(settings.customMedia).toBe(false)
  })
})

describe("formatPrinterSettings", () => {
  it("names the printer and marks unavailable settings", () => {
    expect(formatPrinterSettings("broken", null)).toContain("broken")
    expect(formatPrinterSettings("broken", null)).toContain("unavailable")
    const text = formatPrinterSettings("pdf", describePrinterSettings(parseLpoptions(CUPS_PDF)))
    expect(text).toContain("quality: not supported")
    expect(text).toContain("A4 (default)")
  })
})

describe("JIS media", () => {
  it("resolves JIS names to custom sizes in millimetres and passes other media through", () => {
    expect(resolveMedia("JIS-B5")).toBe("Custom.182x257mm")
    expect(resolveMedia("JIS-B6")).toBe("Custom.128x182mm")
    expect(resolveMedia("A4")).toBe("A4")
    expect(resolveMedia("JISB5")).toBe("JISB5")
  })

  it("sends the custom size to CUPS", () => {
    expect(buildCupsOptions({ media: "JIS-B5" })).toEqual(["media=Custom.182x257mm"])
  })
})
