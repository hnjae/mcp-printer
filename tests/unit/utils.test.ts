// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 Steve CLARKE
// SPDX-FileCopyrightText: 2026 KIM Hyunjae

/**
 * @fileoverview Unit tests for pure utility functions
 */

import { describe, expect, it } from "bun:test"
import { parseDelimitedString } from "../../src/utils.ts"

describe("parseDelimitedString", () => {
  it("should parse colon-delimited string", () => {
    const result = parseDelimitedString("foo:bar:baz", ":")
    expect(result).toEqual(["foo", "bar", "baz"])
  })

  it("should parse comma-delimited string", () => {
    const result = parseDelimitedString("a,b,c", ",")
    expect(result).toEqual(["a", "b", "c"])
  })

  it("should parse space-delimited string with regex", () => {
    const result = parseDelimitedString("opt1 opt2  opt3", /\s+/)
    expect(result).toEqual(["opt1", "opt2", "opt3"])
  })

  it("should trim whitespace and filter empty strings", () => {
    expect(parseDelimitedString(" foo : bar : baz ", ":")).toEqual(["foo", "bar", "baz"])
    expect(parseDelimitedString("foo::bar", ":")).toEqual(["foo", "bar"])
    expect(parseDelimitedString("foo,  ,bar", ",")).toEqual(["foo", "bar"])
    expect(parseDelimitedString("", ":")).toEqual([])
    expect(parseDelimitedString(undefined, ":")).toEqual([])
  })

  it("should apply transform function", () => {
    const result = parseDelimitedString("FOO,Bar,BAZ", ",", (s) => s.toLowerCase())
    expect(result).toEqual(["foo", "bar", "baz"])
  })

  it("should handle single item", () => {
    const result = parseDelimitedString("single", ":")
    expect(result).toEqual(["single"])
  })
})
