// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 KIM Hyunjae

/**
 * @fileoverview The page size documents are rendered on. It follows the `media` of the print call,
 * so a document meant for B5 paper is laid out on B5 instead of being scaled down from A4.
 */

/** A page size in millimetres, portrait. */
export interface PageSize {
  widthMm: number
  heightMm: number
}

export const A4: PageSize = { widthMm: 210, heightMm: 297 }

/** Standard paper by lowercase name: the names printers list in their PPD, and the IPP names of JIS B5 and B6. */
const NAMED_SIZES: Record<string, PageSize> = {
  a3: { widthMm: 297, heightMm: 420 },
  a4: A4,
  a5: { widthMm: 148, heightMm: 210 },
  a6: { widthMm: 105, heightMm: 148 },
  letter: { widthMm: 215.9, heightMm: 279.4 },
  legal: { widthMm: 215.9, heightMm: 355.6 },
  jis_b5_182x257mm: { widthMm: 182, heightMm: 257 },
  jis_b6_128x182mm: { widthMm: 128, heightMm: 182 },
}

const MM_PER_UNIT = { mm: 1, cm: 10, in: 25.4, pt: 25.4 / 72 } as const

/** Millimetres, to a hundredth, so unit conversions do not leave float noise in the CSS. */
const toMm = (value: string, unit: keyof typeof MM_PER_UNIT): number =>
  Math.round(Number(value) * MM_PER_UNIT[unit] * 100) / 100

/**
 * Find the page size a `media` value stands for.
 *
 * Understood: the standard paper names above, IPP names that carry their size such as
 * `iso_a4_210x297mm`, printer names made of dimensions such as `4x6` (inches) and `215x345mm`, and
 * `Custom.<W>x<H>` with mm, cm, in or pt (points by default). A suffix such as `.Borderless` is
 * ignored. Any other name gives A4.
 *
 * @param media - The `media` value of the print call, if any
 * @returns The page size to render on
 */
export function pageSizeForMedia(media: string | undefined): PageSize {
  if (!media) {
    return A4
  }
  const name = media.toLowerCase()

  const custom = /^custom\.(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)(mm|cm|in|pt)?$/.exec(name)
  if (custom) {
    const unit = (custom[3] ?? "pt") as keyof typeof MM_PER_UNIT
    return { widthMm: toMm(custom[1] ?? "0", unit), heightMm: toMm(custom[2] ?? "0", unit) }
  }

  const base = NAMED_SIZES[name] ? name : name.replace(/\.[a-z][a-z-]*$/, "")
  const named = NAMED_SIZES[base]
  if (named) {
    return named
  }

  // A printer's own size, named by its dimensions as CUPS does in a PPD it generates from IPP: inches
  // unless the name says mm
  const dimensions = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)(mm|in)?$/.exec(base)
  if (dimensions) {
    const unit = (dimensions[3] ?? "in") as "mm" | "in"
    return { widthMm: toMm(dimensions[1] ?? "0", unit), heightMm: toMm(dimensions[2] ?? "0", unit) }
  }

  const ipp = /_(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)(mm|in)$/.exec(name)
  if (ipp) {
    const unit = ipp[3] as "mm" | "in"
    return { widthMm: toMm(ipp[1] ?? "0", unit), heightMm: toMm(ipp[2] ?? "0", unit) }
  }

  return A4
}

/**
 * Put the page size in front of a document's own styles, so a size the document sets itself wins.
 * Chrome prints on Letter unless the document asks for another page size.
 *
 * @param html - The document
 * @param size - The page size to render on
 * @returns The document with an `@page` size rule added
 */
export function withPageSize(html: string, size: PageSize): string {
  const style = `<style>@page{size:${size.widthMm}mm ${size.heightMm}mm}</style>`
  const head = /<head(\s[^>]*)?>/i.exec(html)
  if (head) {
    const end = head.index + head[0].length
    return html.slice(0, end) + style + html.slice(end)
  }
  const doctype = /^\s*<!doctype[^>]*>/i.exec(html)
  if (doctype) {
    return doctype[0] + style + html.slice(doctype[0].length)
  }
  return style + html
}
