// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 KIM Hyunjae

/**
 * @fileoverview The typed print settings the tools accept (sides, media, orientation, quality)
 * and per-printer values for them, derived from `lpoptions -l` output. Also defines the JIS
 * B-series sizes the server adds as custom sizes for printers that do not list them.
 */

export const SIDES = ["one-sided", "two-sided-long-edge", "two-sided-short-edge"] as const
export const ORIENTATIONS = ["portrait", "landscape"] as const
export const QUALITIES = ["draft", "normal", "high"] as const

/**
 * JIS B-series sizes offered as `media` values. A printer gets one when it lists the A-series
 * size in `requires` and custom page sizes, and has no native size of that kind.
 */
export const JIS_SIZES = {
  "JIS-B5": { widthMm: 182, heightMm: 257, requires: "A4", native: "JISB5" },
  "JIS-B6": { widthMm: 128, heightMm: 182, requires: "A5", native: "JISB6" },
} as const

type JisName = keyof typeof JIS_SIZES

/** PPD choice that marks support for custom page sizes in the `PageSize` option. */
const CUSTOM_PAGE_SIZE = "Custom.WIDTHxHEIGHT"

/**
 * Replace a JIS size name with the equivalent custom size; any other media passes through.
 *
 * @param media - The `media` value from the tool call
 * @returns The value to send to CUPS
 */
export function resolveMedia(media: string): string {
  const jis = JIS_SIZES[media as JisName]
  return jis ? `Custom.${jis.widthMm}x${jis.heightMm}mm` : media
}

/** One PPD option: its choices without markers, and the default choice if marked. */
export interface PpdOption {
  choices: string[]
  default?: string
}

/**
 * Parse `lpoptions -l` output: lines of `Keyword/UI text: choice *defaultChoice ...`.
 * Choice names never contain ": ", while UI text may, so the choices start after the last ": ".
 * Lines and tokens that do not look like this format are skipped.
 *
 * @param text - Output of `lpoptions -p <printer> -l`
 * @returns Options by PPD keyword
 */
export function parseLpoptions(text: string): Record<string, PpdOption> {
  const options: Record<string, PpdOption> = {}
  for (const line of text.split("\n")) {
    const keyword = /^([A-Za-z0-9_-]+)\//.exec(line)?.[1]
    const split = line.lastIndexOf(": ")
    if (!keyword || split < 0) {
      continue
    }
    const option: PpdOption = { choices: [] }
    for (const token of line.slice(split + 2).split(/\s+/)) {
      if (!/^\*?[A-Za-z0-9._+-]+$/.test(token)) {
        continue
      }
      const choice = token.replace(/^\*/, "")
      option.choices.push(choice)
      if (token.startsWith("*")) {
        option.default = choice
      }
    }
    options[keyword] = option
  }
  return options
}

/** A value for a print tool parameter, and whether it is the printer's default. */
export interface SettingValue {
  value: string
  isDefault: boolean
}

/** Print settings one printer accepts, as tool parameter values. */
export interface PrinterSettings {
  sides: SettingValue[]
  /** Empty if the printer does not report page sizes */
  media: SettingValue[]
  /** Whether `Custom.<W>x<H>mm` is accepted for any size in millimetres */
  customMedia: boolean
  /** Empty if the printer has no print quality option */
  quality: SettingValue[]
}

const SIDES_BY_DUPLEX: Record<string, (typeof SIDES)[number]> = {
  None: "one-sided",
  DuplexNoTumble: "two-sided-long-edge",
  DuplexTumble: "two-sided-short-edge",
}

/**
 * Translate PPD options into the values `sides`, `media` and `quality` accept.
 *
 * @param options - Parsed `lpoptions -l` output
 * @returns Settings with the printer's defaults marked
 */
export function describePrinterSettings(options: Record<string, PpdOption>): PrinterSettings {
  const duplex = options.Duplex
  const sides: SettingValue[] = duplex
    ? duplex.choices.flatMap((choice) => {
        const value = SIDES_BY_DUPLEX[choice]
        return value ? [{ value, isDefault: choice === duplex.default }] : []
      })
    : [{ value: "one-sided", isDefault: true }]

  const pageSize = options.PageSize
  const listed = pageSize?.choices ?? []
  const customMedia = listed.includes(CUSTOM_PAGE_SIZE)
  const media: SettingValue[] = listed
    .filter((choice) => choice !== CUSTOM_PAGE_SIZE)
    .map((value) => ({ value, isDefault: value === pageSize?.default }))
  for (const [name, jis] of Object.entries(JIS_SIZES)) {
    const hasNative = listed.some(
      (choice) => choice === jis.native || choice.startsWith(`${jis.native}.`)
    )
    if (customMedia && listed.includes(jis.requires) && !hasNative) {
      media.push({ value: name, isDefault: false })
    }
  }

  const printQuality = options.cupsPrintQuality
  const quality: SettingValue[] = (printQuality?.choices ?? []).flatMap((choice) => {
    const value = choice.toLowerCase()
    return (QUALITIES as readonly string[]).includes(value)
      ? [{ value, isDefault: choice === printQuality?.default }]
      : []
  })

  return { sides, media, customMedia, quality }
}

const formatValues = (values: SettingValue[]) =>
  values.map(({ value, isDefault }) => (isDefault ? `${value} (default)` : value)).join(", ")

/**
 * Format one printer's settings as text for `list_printers`.
 *
 * @param name - Printer name
 * @param settings - Settings from describePrinterSettings, or null if they could not be read
 * @returns Lines describing the values the print tools accept for this printer
 */
export function formatPrinterSettings(name: string, settings: PrinterSettings | null): string {
  if (!settings) {
    return `${name}: print settings unavailable`
  }
  const mediaParts = [formatValues(settings.media)].filter(Boolean)
  if (settings.customMedia) {
    mediaParts.push("or any size as Custom.<W>x<H>mm, e.g. Custom.182x257mm")
  }
  return [
    `${name}:`,
    `  sides: ${formatValues(settings.sides)}`,
    `  media: ${mediaParts.join("; ") || "not reported"}`,
    `  quality: ${formatValues(settings.quality) || "not supported"}`,
  ].join("\n")
}
