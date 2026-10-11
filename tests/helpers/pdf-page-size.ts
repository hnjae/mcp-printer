// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 KIM Hyunjae

import { readFileSync } from "node:fs"

/**
 * Read the size of the first page of a PDF from its MediaBox.
 *
 * @param path - Path to a PDF written by Chrome, whose page dictionaries are stored uncompressed
 * @returns The width and height in PostScript points
 */
export function firstPageSize(path: string): { width: number; height: number } {
  const text = readFileSync(path).toString("latin1")
  const match = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(text)
  if (!match) {
    throw new Error(`No MediaBox in ${path}`)
  }
  return { width: Number(match[1]), height: Number(match[2]) }
}

export const A4 = { width: 595, height: 842 }
export const LETTER = { width: 612, height: 792 }
export const B5 = { width: 516, height: 729 }

/** Whether a measured size is the given paper size, allowing for rounding. */
export function isSize(size: { width: number; height: number }, paper: typeof A4): boolean {
  return Math.abs(size.width - paper.width) < 2 && Math.abs(size.height - paper.height) < 2
}
