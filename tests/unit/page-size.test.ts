// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 KIM Hyunjae

/**
 * @fileoverview The page size a document is rendered on follows the `media` of the print call.
 */

import { describe, expect, it } from "bun:test"
import { A4, pageSizeForMedia, withPageSize } from "../../src/page-size.js"

const near = (actual: number, expected: number) => Math.abs(actual - expected) < 0.1

describe("pageSizeForMedia", () => {
  it("renders on A4 without a media or for names it does not know", () => {
    expect(pageSizeForMedia(undefined)).toEqual(A4)
    expect(pageSizeForMedia("EnvDL")).toEqual(A4)
    expect(pageSizeForMedia("JISB5")).toEqual(A4)
    expect(pageSizeForMedia("Custom.WIDTHxHEIGHT")).toEqual(A4)
  })

  it("knows the standard paper names, in any letter case", () => {
    expect(pageSizeForMedia("A3")).toEqual({ widthMm: 297, heightMm: 420 })
    expect(pageSizeForMedia("a5")).toEqual({ widthMm: 148, heightMm: 210 })
    const letter = pageSizeForMedia("Letter")
    expect(near(letter.widthMm, 215.9) && near(letter.heightMm, 279.4)).toBe(true)
    const legal = pageSizeForMedia("legal")
    expect(near(legal.widthMm, 215.9) && near(legal.heightMm, 355.6)).toBe(true)
  })

  it("knows JIS B5 and B6 by their IPP names", () => {
    expect(pageSizeForMedia("jis_b5_182x257mm")).toEqual({ widthMm: 182, heightMm: 257 })
    expect(pageSizeForMedia("jis_b6_128x182mm")).toEqual({ widthMm: 128, heightMm: 182 })
  })

  it("ignores a variant suffix such as .Borderless", () => {
    expect(pageSizeForMedia("A4.Borderless")).toEqual(A4)
    expect(pageSizeForMedia("Letter.Borderless")).toEqual(pageSizeForMedia("Letter"))
  })

  it("reads the size out of IPP names that carry it", () => {
    expect(pageSizeForMedia("iso_a4_210x297mm")).toEqual(A4)
    const letter = pageSizeForMedia("na_letter_8.5x11in")
    expect(near(letter.widthMm, 215.9) && near(letter.heightMm, 279.4)).toBe(true)
  })

  it("reads a printer's own sizes named by their dimensions, in inches unless the name says mm", () => {
    const photo = pageSizeForMedia("4x6")
    expect(near(photo.widthMm, 101.6) && near(photo.heightMm, 152.4)).toBe(true)
    expect(pageSizeForMedia("3.5x5.Borderless")).toEqual(pageSizeForMedia("3.5x5"))
    expect(pageSizeForMedia("215x345mm")).toEqual({ widthMm: 215, heightMm: 345 })
  })

  it("reads custom sizes in millimetres, centimetres, inches and points", () => {
    expect(pageSizeForMedia("Custom.182x257mm")).toEqual({ widthMm: 182, heightMm: 257 })
    expect(pageSizeForMedia("Custom.18x25cm")).toEqual({ widthMm: 180, heightMm: 250 })
    const inches = pageSizeForMedia("Custom.5x8in")
    expect(near(inches.widthMm, 127) && near(inches.heightMm, 203.2)).toBe(true)
    const points = pageSizeForMedia("Custom.595x842")
    expect(near(points.widthMm, 209.9) && near(points.heightMm, 297)).toBe(true)
  })
})

describe("withPageSize", () => {
  const rule = "@page{size:210mm 297mm}"

  it("adds the size at the start of the head, ahead of the document's own styles", () => {
    const html = withPageSize("<!DOCTYPE html><html><head><style>p{}</style></head></html>", A4)

    expect(html.indexOf(rule)).toBeGreaterThan(html.indexOf("<head>"))
    expect(html.indexOf(rule)).toBeLessThan(html.indexOf("p{}"))
  })

  it("keeps the doctype first when there is no head", () => {
    const html = withPageSize("<!doctype html><meta charset=utf-8><p>x</p>", {
      widthMm: 182,
      heightMm: 257,
    })

    expect(html.startsWith("<!doctype html>")).toBe(true)
    expect(html).toContain("@page{size:182mm 257mm}")
  })

  it("adds the size to a fragment", () => {
    expect(withPageSize("<p>x</p>", A4).startsWith(`<style>${rule}</style>`)).toBe(true)
  })

  it("does not mistake a header element for the head", () => {
    expect(withPageSize("<header>x</header>", A4).startsWith("<style>")).toBe(true)
  })
})
