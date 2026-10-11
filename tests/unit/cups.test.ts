// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 KIM Hyunjae

/**
 * @fileoverview Unit tests for the CUPS access module.
 */

import { describe, expect, it } from "bun:test"
import { parseLpoptions } from "../../src/cups.js"

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
