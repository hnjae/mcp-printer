// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 Steve CLARKE
// SPDX-FileCopyrightText: 2026 KIM Hyunjae

/**
 * @fileoverview General utility functions for command execution, dependency checking,
 * file type detection, and print job handling for the MCP Printer server.
 */

import { constants, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs"
import { access, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, extname, join } from "node:path"
import { type ExecaError, execa } from "execa"
import { encode } from "he"
import { PDFParse } from "pdf-parse"
import { config, MARKDOWN_EXTENSIONS, type MarkdownExtension } from "./config.ts"
import { getDefaultPrinter, readPrinterOptions, submitJob } from "./cups.ts"
import { validateFilePath } from "./file-security.ts"
import { A4, type PageSize, withPageSize } from "./page-size.ts"
import {
  JIS_SIZES,
  type ORIENTATIONS,
  type QUALITIES,
  resolveMedia,
  type SIDES,
} from "./print-settings.ts"
import { renderCodeToPdf, shouldRenderCode } from "./renderers/code.ts"
import { renderMarkdownToPdf } from "./renderers/markdown.ts"
import { hardenHtml, sanitizeUntrustedMarkdown } from "./untrusted-content.ts"

/**
 * Parse a delimited string into an array of strings.
 * Automatically trims whitespace and filters out empty strings.
 *
 * @param value - String to parse (can be undefined)
 * @param delimiter - Delimiter to split on (string or regex)
 * @param transform - Optional transform function to apply to each item (e.g., toLowerCase)
 * @returns Array of parsed strings, or empty array if value is undefined
 *
 * @example
 * parseDelimitedString('foo:bar:baz', ':') // ['foo', 'bar', 'baz']
 * parseDelimitedString('Foo, Bar, Baz', ',', s => s.toLowerCase()) // ['foo', 'bar', 'baz']
 * parseDelimitedString('opt1 opt2  opt3', /\s+/) // ['opt1', 'opt2', 'opt3']
 */
export function parseDelimitedString(
  value: string | undefined,
  delimiter: string | RegExp,
  transform?: (item: string) => string
): string[] {
  if (!value) {
    return []
  }

  return value
    .split(delimiter)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => (transform ? transform(item) : item))
}

/**
 * Executes a command safely without spawning a shell.
 *
 * @param command - The command binary to execute
 * @param args - Array of arguments to pass to the command
 * @returns The trimmed stdout output from the command
 * @throws {Error} If the command fails or returns an error
 */
export async function execCommand(command: string, args: string[] = []): Promise<string> {
  try {
    const { stdout } = await execa(command, args)
    return stdout.trim()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Command failed: ${message}`)
  }
}

/**
 * Checks if a file exists at the given path.
 *
 * @param filePath - Path to check
 * @returns True if file exists and is accessible, false otherwise
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

/**
 * Checks if a file contains a shebang (#!) in the first 1024 bytes.
 * Used to detect executable scripts without standard file extensions.
 *
 * @param filePath - Path to the file to check
 * @returns True if shebang found, false otherwise
 */
export async function hasShebang(filePath: string): Promise<boolean> {
  try {
    // Read first 1024 bytes of the file
    const buffer = Buffer.alloc(1024)
    const { open } = await import("node:fs/promises")
    const fileHandle = await open(filePath, "r")

    try {
      const { bytesRead } = await fileHandle.read(buffer, 0, 1024, 0)
      await fileHandle.close()

      if (bytesRead === 0) {
        return false
      }

      // Convert buffer to string and check for shebang
      const content = buffer.toString("utf-8", 0, bytesRead)
      // Handle all line ending types: Unix (\n), Windows (\r\n), old Mac (\r)
      const lines = content.split(/\r?\n|\r/)

      // Check if any line starts with #!
      // Note: Trim handles extra whitespace, though technically shebangs
      // must be the first two bytes. We're lenient to catch more cases.
      return lines.some((line) => line.trim().startsWith("#!"))
    } catch {
      await fileHandle.close()
      return false
    }
  } catch {
    return false
  }
}

/**
 * Checks if a command-line tool is available in the system PATH.
 *
 * @param command - The command to check (e.g., "pandoc")
 * @param name - Human-readable name for error messages
 * @throws {Error} If the command is not found, with installation instructions
 */
export async function checkDependency(command: string, name: string): Promise<void> {
  try {
    await execCommand("which", [command])
  } catch {
    throw new Error(`${name} not found. Install with: brew install ${command}`)
  }
}

/**
 * Locates a Chrome or Chromium installation on the system.
 * First checks the MCP_PRINTER_CHROME_PATH environment variable,
 * then searches common macOS and Linux installation paths.
 *
 * @returns Path to Chrome/Chromium executable
 * @throws {Error} If Chrome is not found
 */
export async function findChrome(): Promise<string> {
  // Check environment variable first
  if (config.chromePath) {
    if (await fileExists(config.chromePath)) {
      return config.chromePath
    }
    // If specified path doesn't exist, continue to auto-detection
  }

  // Check macOS paths
  if (process.platform === "darwin") {
    const macPaths = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    ]

    for (const path of macPaths) {
      if (await fileExists(path)) {
        return path
      }
    }
  }

  // Check Linux paths
  if (process.platform === "linux") {
    const linuxCommands = ["google-chrome", "chromium", "chromium-browser"]
    for (const cmd of linuxCommands) {
      try {
        const path = await execCommand("which", [cmd])
        if (path) return path
      } catch {
        // Continue to next command
      }
    }
  }

  throw new Error(
    "Chrome not found. Install Google Chrome or set MCP_PRINTER_CHROME_PATH environment variable."
  )
}

/**
 * Chrome arguments that follow from configuration: --no-sandbox when
 * MCP_PRINTER_CHROME_NO_SANDBOX is enabled (needed for root inside containers).
 *
 * @returns Arguments to pass to every Chrome launch
 */
export function getChromeSandboxArgs(): string[] {
  return config.chromeNoSandbox ? ["--no-sandbox"] : []
}

/**
 * Converts HTML content to PDF using Chrome headless.
 * Handles Chrome detection, temp file creation, execution, error handling, and cleanup.
 *
 * @param htmlContent - HTML content to convert to PDF
 * @param options - Optional configuration
 * @param options.chromeFlags - Additional Chrome flags (e.g., ['--disable-javascript'])
 * @param options.tempDirPrefix - Prefix for temp directory name (default: 'mcp-printer-')
 * @param options.pageSize - Page size to render on (default: A4)
 * @returns Path to the generated temporary PDF file
 * @throws {Error} If Chrome is not found or PDF generation fails
 */
export async function convertHtmlToPdf(
  htmlContent: string,
  options: { chromeFlags?: string[]; tempDirPrefix?: string; pageSize?: PageSize } = {}
): Promise<string> {
  const { chromeFlags = [], tempDirPrefix = "mcp-printer-", pageSize = A4 } = options

  // Find Chrome/Chromium executable
  const chromePath = await findChrome()

  // Create secure temp directory
  const tmpDir = mkdtempSync(join(tmpdir(), tempDirPrefix))
  const tmpHtml = join(tmpDir, "input.html")
  const tmpPdf = join(tmpDir, "output.pdf")

  try {
    // Write HTML to temp file
    writeFileSync(tmpHtml, withPageSize(htmlContent, pageSize), "utf-8")

    // Convert HTML to PDF with Chrome headless
    try {
      await execa(chromePath, [
        "--headless",
        "--disable-gpu",
        "--no-pdf-header-footer",
        ...getChromeSandboxArgs(),
        ...chromeFlags,
        `--print-to-pdf=${tmpPdf}`,
        tmpHtml,
      ])
    } catch (error) {
      // Chrome outputs success messages to stderr, check if PDF was actually created
      const execaError = error as ExecaError
      const stderr = String(execaError.stderr ?? "")
      if (!stderr.includes("written to file")) {
        throw new Error(`Failed to render PDF: ${execaError.message}`)
      }
      // Success - Chrome wrote the PDF and reported to stderr
    }

    // Clean up HTML file
    try {
      unlinkSync(tmpHtml)
    } catch {
      // Ignore cleanup errors
    }

    return tmpPdf
  } catch (error) {
    // Clean up temp files on error
    try {
      unlinkSync(tmpHtml)
    } catch {}
    try {
      unlinkSync(tmpPdf)
    } catch {}
    throw error
  }
}

/**
 * Determines if a file should be automatically rendered to PDF before printing.
 * Checks autoRenderMarkdown setting and standard markdown extensions (.md, .markdown).
 *
 * @param filePath - Path to the file to check
 * @returns True if the file should be rendered to PDF, false otherwise
 */
export function shouldRenderToPdf(filePath: string): boolean {
  if (!config.autoRenderMarkdown) {
    return false
  }
  // Extract extension using path.extname (returns '.md' or '')
  const ext = extname(filePath).slice(1).toLowerCase()
  return MARKDOWN_EXTENSIONS.includes(ext as MarkdownExtension)
}

/**
 * Print settings that map to CUPS options.
 * `sides`, `media` and `orientation` take precedence over `options` and the configured defaults.
 */
export interface PrintOptions {
  /** Space-separated CUPS options (free-form escape hatch) */
  options?: string
  sides?: (typeof SIDES)[number]
  media?: string
  orientation?: (typeof ORIENTATIONS)[number]
  quality?: (typeof QUALITIES)[number]
}

/** IPP `orientation-requested` values for each orientation. */
const ORIENTATION_REQUESTED = { portrait: 3, landscape: 4 } as const

/** PPD `cupsPrintQuality` choices for each quality. */
const PRINT_QUALITY_CHOICE = { draft: "Draft", normal: "Normal", high: "High" } as const

/**
 * Remove every occurrence of the given option names, with or without a value, from `all`.
 * Used when a typed setting is also reachable under a different CUPS key that ordering cannot
 * override.
 */
function dropOptions(all: string[], names: string[]): string[] {
  return all.filter((option) => !names.includes(option.split("=")[0] ?? option))
}

/**
 * Build the effective CUPS option list for a print job. When an option name occurs more than
 * once, the last occurrence wins, so the order is: MCP_PRINTER_DEFAULT_OPTIONS,
 * the free-form `options` string, then the typed settings. A typed `orientation` or `quality`
 * also removes the alias `landscape` or `print-quality` from the defaults and `options`.
 *
 * @param settings - Typed settings and free-form options from the tool call
 * @returns Option strings in precedence order, each in `name=value` or `name` form
 */
export function buildCupsOptions({
  options,
  sides,
  media,
  orientation,
  quality,
}: PrintOptions): string[] {
  let all: string[] = []
  all.push(...config.defaultOptions)
  if (options) {
    all.push(...options.split(/\s+/).filter(Boolean))
  }
  if (orientation) {
    all = dropOptions(all, ["landscape"])
  }
  if (quality) {
    all = dropOptions(all, ["print-quality"])
  }
  if (sides) {
    all.push(`sides=${sides}`)
  }
  if (media) {
    all.push(`media=${media}`)
  }
  if (orientation) {
    all.push(`orientation-requested=${ORIENTATION_REQUESTED[orientation]}`)
  }
  if (quality) {
    all.push(`cupsPrintQuality=${PRINT_QUALITY_CHOICE[quality]}`)
  }
  return all
}

/**
 * Turn a JIS `media` name into what the target printer accepts. Only JIS sizes cost an extra
 * read of the printer's options; if it fails, `media` is sent unchanged for CUPS to judge.
 */
async function withResolvedMedia(settings: PrintOptions, printer?: string): Promise<PrintOptions> {
  const { media } = settings
  if (!media || !(media in JIS_SIZES)) {
    return settings
  }
  const pageSizes = (await readPrinterOptions(printer))?.PageSize?.choices ?? []
  return { ...settings, media: resolveMedia(media, pageSizes) }
}

/**
 * Execute a print job with the given file and options.
 * Handles copy validation, option assembly, and execution.
 *
 * @param filePath - Path to the file to print
 * @param printer - Optional printer name
 * @param copies - Number of copies to print
 * @param settings - Typed settings and free-form CUPS options
 * @returns Object with printer name and formatted options
 */
export async function executePrintJob(
  filePath: string,
  printer?: string,
  copies: number = 1,
  settings: PrintOptions = {}
): Promise<{ printerName: string; allOptions: string[] }> {
  // Validate copy count against configured maximum
  if (config.maxCopies > 0 && copies > config.maxCopies) {
    throw new Error(
      `Copy count (${copies}) exceeds maximum allowed (${config.maxCopies}). ` +
        `Set MCP_PRINTER_MAX_COPIES environment variable to increase or use 0 for unlimited.`
    )
  }

  // Use configured default printer if none specified
  const targetPrinter = printer || config.defaultPrinter

  const allOptions = buildCupsOptions(await withResolvedMedia(settings, targetPrinter))
  await submitJob({
    file: filePath,
    printer: targetPrinter || undefined,
    copies,
    options: allOptions,
  })

  // Determine the printer name used
  const printerName =
    targetPrinter || (await getDefaultPrinter().catch(() => undefined)) || "default"

  return { printerName, allOptions }
}

/**
 * Gets the page count from a PDF file using pdf-parse.
 *
 * @param filePath - Path to the PDF file
 * @returns Number of pages in the PDF
 * @throws {Error} If the file cannot be read or parsed
 */
export async function getPdfPageCount(filePath: string): Promise<number> {
  const parser = new PDFParse({ data: await readFile(filePath) })
  try {
    const result = await parser.getInfo()
    return result.total
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to get PDF page count: ${message}`)
  } finally {
    await parser.destroy()
  }
}

/**
 * Calculates the number of physical sheets needed based on page count and duplex settings.
 *
 * @param pdfPages - Total number of PDF pages
 * @param isDuplex - Whether duplex printing is enabled
 * @returns Number of physical sheets that will be used
 */
export function calculatePhysicalSheets(pdfPages: number, isDuplex: boolean): number {
  return isDuplex ? Math.ceil(pdfPages / 2) : pdfPages
}

/**
 * Checks if the page count exceeds the confirmation threshold.
 *
 * @param physicalSheets - Number of physical sheets to print
 * @returns True if confirmation is needed, false otherwise
 */
export function shouldTriggerConfirmation(physicalSheets: number): boolean {
  return config.confirmIfOverPages > 0 && physicalSheets > config.confirmIfOverPages
}

/**
 * Result of file rendering operation.
 */
export interface RenderResult {
  /** Path to the file to use (either original or rendered PDF) */
  actualFilePath: string
  /** Path to rendered PDF temp file (null if no rendering occurred) */
  renderedPdf: string | null
  /** Description of rendering performed (empty string if no rendering) */
  renderType: string
}

/**
 * Options for file rendering.
 */
export interface RenderOptions {
  /** Path to the file to render */
  filePath: string
  /** How to render the file; omitted means detect from the file and the configuration */
  render?: RenderMode
  /** Page size of a rendered document (default: A4) */
  pageSize?: PageSize
}

export const RENDER_MODES = ["markdown", "code", "none"] as const

export type RenderMode = (typeof RENDER_MODES)[number]

/**
 * Prepares a file for printing by conditionally rendering it to PDF.
 *
 * This is the core function used by both `print_file` and `get_page_meta` tools.
 * It determines whether a file needs to be rendered to PDF (for enhanced formatting)
 * or can be printed as-is.
 *
 * **Rendering Behavior:**
 * - **`render` given**: the file is rendered as Markdown or as code, or passed through for `none`,
 *   whatever its extension
 * - **`render` omitted, Markdown files** (`.md`, `.markdown`): Rendered to PDF with full
 *   formatting, unless auto-rendering is disabled
 * - **`render` omitted, code files**: Rendered to PDF with syntax highlighting, unless
 *   auto-rendering is disabled
 * - **Other files** (PDF, text, images, etc.): Passed through without modification
 *
 * **Security:** All file paths are validated against allowed/denied paths before processing.
 *
 * **Error Handling:** If rendering fails, an error is thrown.
 *
 * @param options - File preparation options including path and rendering preferences
 * @param options.filePath - Absolute or relative path to the file to prepare
 * @param options.render - Explicitly choose how to render the file
 * @param options.pageSize - Page size of a rendered document (default: A4)
 *
 * @returns Promise resolving to a RenderResult object
 * @returns result.actualFilePath - The file path to actually print (original or rendered PDF)
 * @returns result.renderedPdf - Path to temporary PDF if rendered, null if using original file
 * @returns result.renderType - Human-readable description of rendering (e.g., "markdown → PDF"),
 *                               empty string if no rendering occurred
 *
 * @throws {Error} If file path validation fails (security check)
 * @throws {Error} If rendering fails
 *
 * @example
 * // Prepare a markdown file (will be rendered to PDF)
 * const result = await prepareFileForPrinting({ filePath: "README.md" })
 * // result.actualFilePath = "/tmp/rendered-abc123.pdf"
 * // result.renderedPdf = "/tmp/rendered-abc123.pdf"
 * // result.renderType = "markdown → PDF"
 *
 * @example
 * // Prepare a PDF file (used as-is)
 * const result = await prepareFileForPrinting({ filePath: "document.pdf" })
 * // result.actualFilePath = "document.pdf"
 * // result.renderedPdf = null
 * // result.renderType = ""
 */
export async function prepareFileForPrinting(options: RenderOptions): Promise<RenderResult> {
  // Validate file path security
  validateFilePath(options.filePath)

  let actualFilePath = options.filePath
  let renderedPdf: string | null = null
  let renderType = ""

  const render: RenderMode =
    options.render ??
    (shouldRenderToPdf(options.filePath)
      ? "markdown"
      : (await shouldRenderCode(options.filePath))
        ? "code"
        : "none")

  if (render === "markdown") {
    renderedPdf = await renderMarkdownToPdf(options.filePath, options.pageSize)
    actualFilePath = renderedPdf
    renderType = "markdown → PDF"
  } else if (render === "code") {
    renderedPdf = await renderCodeToPdf(options.filePath, options.pageSize)
    actualFilePath = renderedPdf
    renderType = "code → PDF (syntax highlighted)"
  }

  return { actualFilePath, renderedPdf, renderType }
}

/**
 * Determines if the job will print duplex, from the effective `sides` setting.
 *
 * @param settings - Typed settings and free-form CUPS options
 * @returns True if the effective `sides` option is a two-sided mode
 */
export function isDuplexEnabled(settings: PrintOptions = {}): boolean {
  const sides = buildCupsOptions(settings)
    .filter((option) => option.startsWith("sides="))
    .at(-1)
  return sides?.startsWith("sides=two-sided") ?? false
}

/**
 * Cleans up a rendered PDF temp file if it exists.
 *
 * @param renderedPdf - Path to rendered PDF temp file (or null)
 */
export function cleanupRenderedPdf(renderedPdf: string | null): void {
  if (renderedPdf) {
    try {
      unlinkSync(renderedPdf)
    } catch {
      // Ignore cleanup errors
    }
  }
}

/** Formats accepted by print_content. */
export const CONTENT_FORMATS = ["markdown", "html", "code", "text"] as const

export type ContentFormat = (typeof CONTENT_FORMATS)[number]

/**
 * Options for preparing client-supplied content for printing.
 */
export interface ContentOptions {
  /** Document text sent by the client */
  content: string
  /** How to interpret and render the content */
  format: ContentFormat
  /** File extension or language id selecting syntax highlighting for format "code" (default: "txt") */
  language?: string
  /** Page size of the rendered document (default: A4) */
  pageSize?: PageSize
}

/**
 * Prepares client-supplied content for printing and removes every temporary file afterwards.
 *
 * The content never carries a path from the client, so validateFilePath does not apply. Instead the
 * markdown and HTML renderers get hardened input (see untrusted-content.ts).
 *
 * - **markdown**: rendered to PDF with crossnote
 * - **html**: rendered to PDF with Chrome as a self-contained document
 * - **code**: rendered to PDF with syntax highlighting
 * - **text**: rendered to a monospace PDF without interpretation, so page limits apply
 *
 * @param options - Content and rendering options
 * @param use - Receives the file to print and a description of the rendering performed
 * @returns Whatever `use` returns
 * @throws {Error} If the language is invalid or rendering fails
 */
export async function withPreparedContent<T>(
  options: ContentOptions,
  use: (prepared: { actualFilePath: string; renderType: string }) => Promise<T>
): Promise<T> {
  const tempDir = mkdtempSync(join(tmpdir(), "mcp-printer-content-"))
  let renderedPdf: string | null = null

  try {
    switch (options.format) {
      case "markdown": {
        const file = join(tempDir, "document.md")
        writeFileSync(file, sanitizeUntrustedMarkdown(options.content), "utf-8")
        renderedPdf = await renderMarkdownToPdf(file, options.pageSize)
        return await use({ actualFilePath: renderedPdf, renderType: "markdown → PDF" })
      }
      case "html": {
        renderedPdf = await convertHtmlToPdf(hardenHtml(options.content), {
          pageSize: options.pageSize,
        })
        return await use({ actualFilePath: renderedPdf, renderType: "HTML → PDF" })
      }
      case "code": {
        const language = options.language ?? "txt"
        if (!/^[A-Za-z0-9_+-]{1,20}$/.test(language)) {
          throw new Error(
            `Invalid language "${language}": use a file extension such as "py" or "ts"`
          )
        }
        const file = join(tempDir, `code.${language}`)
        writeFileSync(file, options.content, "utf-8")
        renderedPdf = await renderCodeToPdf(file, options.pageSize)
        return await use({
          actualFilePath: renderedPdf,
          renderType: "code → PDF (syntax highlighted)",
        })
      }
      case "text": {
        const html =
          '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' +
          "pre{font:10pt/1.4 monospace;white-space:pre-wrap;overflow-wrap:anywhere;margin:0}" +
          `</style></head><body><pre>${encode(options.content)}</pre></body></html>`
        renderedPdf = await convertHtmlToPdf(html, { pageSize: options.pageSize })
        return await use({ actualFilePath: renderedPdf, renderType: "text → PDF" })
      }
      default: {
        const unsupported: never = options.format
        throw new Error(`Unsupported format: ${unsupported}`)
      }
    }
  } finally {
    if (renderedPdf && (options.format === "html" || options.format === "text")) {
      // convertHtmlToPdf creates a directory per call that holds only the PDF
      rmSync(dirname(renderedPdf), { recursive: true, force: true })
    }
    cleanupRenderedPdf(renderedPdf)
    rmSync(tempDir, { recursive: true, force: true })
  }
}

/**
 * Largest PDF accepted from a client, in bytes after decoding. The base64 text and the rest of the
 * request must fit in the 4 MiB the HTTP transport accepts, and exactly 3 MiB does not.
 */
export const MAX_PDF_BYTES = 3_000_000

/**
 * Validates a base64-encoded PDF from the client, writes it to a private temporary file and removes
 * the file afterwards.
 *
 * The page count must be readable so the confirmation threshold cannot be bypassed with a PDF that
 * only the print system can parse.
 *
 * @param base64 - PDF bytes encoded as base64
 * @param use - Receives the file to print and a description of the rendering performed
 * @returns Whatever `use` returns
 * @throws {Error} If the data is too large, is not a PDF, or its page count cannot be read
 */
export async function withPreparedPdf<T>(
  base64: string,
  use: (prepared: { actualFilePath: string; renderType: string }) => Promise<T>
): Promise<T> {
  const bytes = Buffer.from(base64, "base64")
  if (bytes.length > MAX_PDF_BYTES) {
    throw new Error(`PDF exceeds the ${MAX_PDF_BYTES / 1_000_000} MB size limit`)
  }
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new Error("Data is not a PDF")
  }

  const tempDir = mkdtempSync(join(tmpdir(), "mcp-printer-pdf-"))
  try {
    const file = join(tempDir, "document.pdf")
    writeFileSync(file, bytes)
    try {
      await getPdfPageCount(file)
    } catch {
      throw new Error("Data is not a readable PDF")
    }
    return await use({ actualFilePath: file, renderType: "" })
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}
