// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 KIM Hyunjae

/**
 * @fileoverview All contact with CUPS. This is the only module that runs CUPS commands or parses
 * their output; callers work with printers, queues and options. It depends on nothing else in the
 * server, so policy such as the target printer or copy limits is decided by its callers.
 */

import { execa } from "execa"

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

/** Longest wait for one printer's options, so an unreachable queue cannot stall a tool call. */
const PRINTER_OPTIONS_TIMEOUT_MS = 10_000

/** Run a CUPS command and return its trimmed stdout. Failures propagate as the command reported them. */
async function run(command: string, args: string[], timeout?: number): Promise<string> {
  const { stdout } = await execa(command, args, { timeout })
  return stdout.trim()
}

/** Like {@link run}, with failures reported as "Command failed: <reason>". */
async function read(command: string, args: string[]): Promise<string> {
  try {
    return await run(command, args)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Command failed: ${message}`)
  }
}

/**
 * Describe the printers as text for people: each queue with its state, and the default.
 *
 * @returns The text, empty if CUPS reports nothing
 */
export function describePrinters(): Promise<string> {
  return read("lpstat", ["-p", "-d"])
}

/**
 * List the names of the print queues.
 *
 * @returns The names, empty if they cannot be listed
 */
export async function listPrinterNames(): Promise<string[]> {
  try {
    return (await run("lpstat", ["-e"])).split("\n").filter(Boolean)
  } catch {
    return []
  }
}

/**
 * Read the default printer.
 *
 * @returns The name, or undefined if none is set
 */
export async function getDefaultPrinter(): Promise<string | undefined> {
  return (await read("lpstat", ["-d"])).split(": ")[1] || undefined
}

/**
 * Show the pending and active jobs as text for people.
 *
 * @param printer - Queue to show, or undefined for all
 * @returns The text, empty if the queue is empty
 */
export function showQueue(printer?: string): Promise<string> {
  return read("lpq", printer ? ["-P", printer] : [])
}

/**
 * Read a printer's PPD options.
 *
 * @param printer - Printer name, or undefined for the default destination
 * @returns The options by PPD keyword, or null if they cannot be read in time
 */
export async function readPrinterOptions(
  printer?: string
): Promise<Record<string, PpdOption> | null> {
  try {
    const stdout = await run(
      "lpoptions",
      [...(printer ? ["-p", printer] : []), "-l"],
      PRINTER_OPTIONS_TIMEOUT_MS
    )
    return parseLpoptions(stdout)
  } catch {
    return null
  }
}

/** A print job for CUPS. */
export interface PrintJob {
  file: string
  /** Queue to print on, or undefined for the default destination */
  printer?: string
  copies: number
  /** CUPS options in `name=value` or `name` form; later ones win */
  options: string[]
}

/**
 * Submit a print job.
 *
 * @param job - The file, destination, copies and options
 * @throws If CUPS rejects the job
 */
export async function submitJob({ file, printer, copies, options }: PrintJob): Promise<void> {
  const args: string[] = []
  if (printer) {
    args.push("-P", printer)
  }
  if (copies > 1) {
    args.push(`-#${copies}`)
  }
  for (const option of options) {
    args.push("-o", option)
  }
  args.push(file)
  await run("lpr", args)
}
