// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 KIM Hyunjae

/**
 * @fileoverview Unit tests for CUPS option building and duplex detection.
 */

import { beforeEach, describe, expect, it, vi } from "bun:test"
import { buildCupsOptions, isDuplexEnabled } from "../../src/utils.js"

const mockConfig = { autoDuplex: false, defaultOptions: [] as string[] }

vi.mock("../../src/config.js", () => ({ config: mockConfig }))

beforeEach(() => {
  mockConfig.autoDuplex = false
  mockConfig.defaultOptions = []
})

describe("buildCupsOptions", () => {
  it("maps typed settings to CUPS options", () => {
    expect(
      buildCupsOptions({ sides: "two-sided-short-edge", media: "A4", orientation: "landscape" })
    ).toEqual(["sides=two-sided-short-edge", "media=A4", "orientation-requested=4"])
    expect(buildCupsOptions({ orientation: "portrait" })).toEqual(["orientation-requested=3"])
  })

  it("passes free-form options through, ignoring extra whitespace", () => {
    expect(buildCupsOptions({ options: " number-up=2  print-quality=5 " })).toEqual([
      "number-up=2",
      "print-quality=5",
    ])
  })

  it("orders typed settings after defaults and free-form options so they win", () => {
    mockConfig.defaultOptions = ["media=Letter"]
    const all = buildCupsOptions({ options: "media=A5", media: "A4" })
    expect(all.filter((option) => option.startsWith("media=")).at(-1)).toBe("media=A4")
  })
})

describe("buildCupsOptions orientation", () => {
  it("drops landscape from defaults and options when orientation is set", () => {
    mockConfig.defaultOptions = ["landscape", "number-up=2"]
    expect(buildCupsOptions({ options: "landscape=true", orientation: "portrait" })).toEqual([
      "number-up=2",
      "orientation-requested=3",
    ])
  })

  it("keeps landscape when orientation is not set", () => {
    expect(buildCupsOptions({ options: "landscape" })).toEqual(["landscape"])
  })
})

describe("buildCupsOptions quality", () => {
  it("maps quality to cupsPrintQuality", () => {
    expect(buildCupsOptions({ quality: "draft" })).toEqual(["cupsPrintQuality=Draft"])
    expect(buildCupsOptions({ quality: "high" })).toEqual(["cupsPrintQuality=High"])
  })

  it("drops print-quality from defaults and options when quality is set", () => {
    mockConfig.defaultOptions = ["print-quality=3"]
    expect(buildCupsOptions({ options: "print-quality=5 number-up=2", quality: "normal" })).toEqual(
      ["number-up=2", "cupsPrintQuality=Normal"]
    )
  })

  it("keeps print-quality when quality is not set", () => {
    expect(buildCupsOptions({ options: "print-quality=5" })).toEqual(["print-quality=5"])
  })
})

describe("isDuplexEnabled", () => {
  it("is false without any sides setting", () => {
    expect(isDuplexEnabled({})).toBe(false)
    expect(isDuplexEnabled({ options: "landscape" })).toBe(false)
  })

  it("detects two-sided modes from sides and from options", () => {
    expect(isDuplexEnabled({ sides: "two-sided-long-edge" })).toBe(true)
    expect(isDuplexEnabled({ options: "sides=two-sided-short-edge" })).toBe(true)
  })

  it("applies auto-duplex unless the call chooses one-sided", () => {
    mockConfig.autoDuplex = true
    expect(isDuplexEnabled({})).toBe(true)
    expect(isDuplexEnabled({ sides: "one-sided" })).toBe(false)
    expect(isDuplexEnabled({ options: "sides=one-sided" })).toBe(false)
  })

  it("lets the typed sides override MCP_PRINTER_DEFAULT_OPTIONS", () => {
    mockConfig.defaultOptions = ["sides=two-sided-long-edge"]
    expect(isDuplexEnabled({})).toBe(true)
    expect(isDuplexEnabled({ sides: "one-sided" })).toBe(false)
  })
})
