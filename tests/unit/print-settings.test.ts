// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 KIM Hyunjae

/**
 * @fileoverview Unit tests for per-printer print settings and JIS size handling.
 */

import { describe, expect, it } from "bun:test"
import {
  describePrinterSettings,
  formatPrinterSettings,
  parseLpoptions,
  resolveMedia,
} from "../../src/print-settings.js"

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

  it("offers jis_b5_182x257mm and jis_b6_128x182mm when A4, A5 and custom sizes are available", () => {
    const media = values(describePrinterSettings(parseLpoptions(INKJET)).media)
    expect(media).toContain("jis_b5_182x257mm")
    expect(media).toContain("jis_b6_128x182mm")
    expect(media).not.toContain("Custom.WIDTHxHEIGHT")
  })

  it("offers a JIS size only when its own A-series size is listed", () => {
    const media = values(
      describePrinterSettings(parseLpoptions("PageSize/x: *A4 Custom.WIDTHxHEIGHT")).media
    )
    expect(media).toContain("jis_b5_182x257mm")
    expect(media).not.toContain("jis_b6_128x182mm")
  })

  it("offers no JIS size without custom size support or a listing of its own", () => {
    const media = values(describePrinterSettings(parseLpoptions("PageSize/x: *A4 A5")).media)
    expect(media).not.toContain("jis_b5_182x257mm")
    expect(media).not.toContain("jis_b6_128x182mm")
  })

  it("shows a size the printer lists itself under the JIS name, without duplicates", () => {
    // A driver PPD names it JISB5; a PPD CUPS generated from IPP names it by its size
    for (const [ppdName, native] of [
      [CUPS_PDF, "JISB5"],
      ["PageSize/x: *A4 182x257mm", "182x257mm"],
    ] as const) {
      const media = values(describePrinterSettings(parseLpoptions(ppdName)).media)
      expect(media.filter((value) => value === "jis_b5_182x257mm")).toHaveLength(1)
      expect(media).not.toContain(native)
    }
  })

  it("offers a native JIS size even without custom size support", () => {
    const media = values(describePrinterSettings(parseLpoptions("PageSize/x: A4 *JISB5")).media)
    expect(media).toContain("jis_b5_182x257mm")
  })

  it("keeps the printer default when it is a native JIS size", () => {
    const { media } = describePrinterSettings(parseLpoptions("PageSize/x: A4 *JISB5"))
    expect(media.find((entry) => entry.isDefault)?.value).toBe("jis_b5_182x257mm")
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

describe("resolveMedia", () => {
  const withCustom = ["A4", "A5", "Custom.WIDTHxHEIGHT"]

  it("sends a JIS size the printer does not list as a custom size in millimetres", () => {
    expect(resolveMedia("jis_b5_182x257mm", withCustom)).toBe("Custom.182x257mm")
    expect(resolveMedia("jis_b6_128x182mm", withCustom)).toBe("Custom.128x182mm")
  })

  it("sends the printer's own choice when it lists the size", () => {
    expect(resolveMedia("jis_b5_182x257mm", [...withCustom, "JISB5"])).toBe("JISB5")
    expect(resolveMedia("jis_b6_128x182mm", ["A5", "128x182mm"])).toBe("128x182mm")
  })

  it("passes a JIS name through when the printer has no custom sizes or no options", () => {
    expect(resolveMedia("jis_b5_182x257mm", ["A4", "A5"])).toBe("jis_b5_182x257mm")
    expect(resolveMedia("jis_b5_182x257mm", [])).toBe("jis_b5_182x257mm")
  })

  it("passes other media, including PPD names, through", () => {
    expect(resolveMedia("A4", withCustom)).toBe("A4")
    expect(resolveMedia("JISB5", withCustom)).toBe("JISB5")
    expect(resolveMedia("Custom.100x200mm", withCustom)).toBe("Custom.100x200mm")
  })
})
