// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 Steve CLARKE
// SPDX-FileCopyrightText: 2026 KIM Hyunjae

/**
 * @fileoverview Markdown file renderer.
 * Converts markdown files to PDF using crossnote.
 * Provides beautiful Markdown Preview Enhanced-quality output with Mermaid diagram support.
 * Automatically adds page numbering to all rendered PDFs.
 */

import { mkdtempSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"
import { Notebook } from "crossnote"
import matter from "gray-matter"
import { encode } from "he"
import { config } from "../config.ts"
import { A4, type PageSize } from "../page-size.ts"
import { assertNoFrontMatterEngine } from "../untrusted-content.ts"
import { findChrome, getChromeSandboxArgs } from "../utils.ts"

/**
 * Print styling on top of the themes: no filled backgrounds, so pages use little ink. Code blocks
 * get an outline instead so they stay set apart from the text.
 */
const SANS_FONT_STACK = "-apple-system, BlinkMacSystemFont, ui-sans-serif, sans-serif"

const PRINT_CSS = `
html body { font-family: ${SANS_FONT_STACK}; }
html body pre, html body code, html body kbd,
pre[class*="language-"], code[class*="language-"] {
  font-family: monospace;
}
html body pre, html body code, html body blockquote, html body kbd,
pre[class*="language-"], code[class*="language-"] { background: transparent !important; }
html body pre, pre[class*="language-"] { border: 1px solid #d6d6d6; }
`

/**
 * Page numbering configuration function for Puppeteer PDF generation.
 * Generates header/footer templates with inline styles (required by Puppeteer).
 * Filename is HTML-escaped to prevent XSS and rendering issues.
 *
 * @param filename - The name of the file being rendered (displayed in footer)
 * @returns Configuration object with header/footer templates
 */
function getPageNumberConfig(filename: string) {
  // Puppeteer PDF headers/footers require inline styles (no external CSS support)
  const footerStyles = {
    container: [
      "font-size: 9px",
      "width: 100%",
      "margin: 0",
      "padding: 0 1cm",
      `font-family: ${SANS_FONT_STACK}`,
      "display: flex",
      "justify-content: space-between",
      "align-items: center",
    ].join("; "),
    filename: "font-size: 8px; color: #666;",
  }

  return {
    displayHeaderFooter: true,
    headerTemplate: "<div></div>",
    footerTemplate: `
      <div style="${footerStyles.container}">
        <span style="${footerStyles.filename}">${encode(filename)}</span>
        <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
      </div>
    `,
    margin: {
      top: "1cm",
      bottom: "1.5cm",
      left: "1cm",
      right: "1cm",
    },
  }
}

/**
 * Injects the page size and page numbering into markdown content's `chrome` front matter.
 * Properly merges with existing front-matter if present.
 * Uses gray-matter's stringify for robust formatting.
 *
 * A document that sets its own `chrome` (or `puppeteer`) options keeps them, including the page
 * numbering it chose; the page size of the call is added only if it names no size of its own.
 *
 * @param content - Original markdown content
 * @param filename - Name of the file being rendered (displayed in footer)
 * @param pageSize - The configured page size
 * @returns Markdown content with the page size and page numbering added/merged
 */
function injectPageNumbering(content: string, filename: string, pageSize: PageSize): string {
  const { data, content: body } = matter(content)
  const size = { width: `${pageSize.widthMm}mm`, height: `${pageSize.heightMm}mm` }

  const ownKey = data.chrome ? "chrome" : data.puppeteer ? "puppeteer" : undefined
  if (!ownKey) {
    // Merge in the chrome config with existing front-matter (even if empty)
    return matter.stringify(body, {
      ...data,
      chrome: { ...getPageNumberConfig(filename), ...size },
    })
  }

  const own = data[ownKey]
  const namesSize =
    typeof own !== "object" || own === null || "format" in own || "width" in own || "height" in own
  if (namesSize) {
    return content
  }
  return matter.stringify(body, { ...data, [ownKey]: { ...size, ...own } })
}

/**
 * Renders a markdown file to PDF using crossnote.
 * Provides beautiful Markdown Preview Enhanced-quality output with
 * comprehensive diagram support. Automatically adds page numbering (Page X /
 * Y) to the footer of each page.
 *
 * @param filePath - Path to the markdown file to render
 * @param pageSize - Page size to render on (default: A4)
 * @returns Path to the generated temporary PDF file
 * @throws {Error} If Chrome is not found or rendering fails
 */
export async function renderMarkdownToPdf(
  filePath: string,
  pageSize: PageSize = A4
): Promise<string> {
  // Read the original markdown content
  const originalContent = readFileSync(filePath, "utf-8")
  assertNoFrontMatterEngine(originalContent)

  // Inject page numbering configuration if not already present
  const contentWithPageNumbers = injectPageNumbering(originalContent, basename(filePath), pageSize)

  // Create a temporary directory for the modified markdown file
  const tempDir = mkdtempSync(join(tmpdir(), "mcp-printer-markdown-"))
  const tempFileName = basename(filePath)
  const tempFilePath = join(tempDir, tempFileName)

  // Write the modified content to temp file
  writeFileSync(tempFilePath, contentWithPageNumbers, "utf-8")

  // Find Chrome executable (required by crossnote/puppeteer)
  const chromePath = config.chromePath || (await findChrome())

  let outputPath: string

  try {
    // Initialize crossnote notebook with configuration, pointing to temp directory
    const notebook = await Notebook.init({
      notebookPath: tempDir,
      config: {
        // Hardcoded themes optimized for printing (light background, clean styling)
        previewTheme: "github-light.css",
        codeBlockTheme: "github.css",
        mermaidTheme: "default",
        globalCss: PRINT_CSS,

        // Math rendering
        mathRenderingOption: "KaTeX",

        // Rendering options
        printBackground: true,
        breakOnSingleNewLine: true,
        enableEmojiSyntax: true,
        enableWikiLinkSyntax: false,
        enableExtendedTableSyntax: false,

        // Chrome configuration
        chromePath,
        puppeteerArgs: getChromeSandboxArgs(),

        // Security: disable script execution
        enableScriptExecution: false,
      },
    })

    // Get the markdown engine for the temp file
    const engine = notebook.getNoteMarkdownEngine(tempFileName)

    // Export to PDF using Chrome/Puppeteer
    // crossnote returns the path to the generated PDF
    outputPath = await engine.chromeExport({
      fileType: "pdf",
      runAllCodeChunks: false, // Don't execute code chunks for security
    })
  } catch (error: unknown) {
    // Clean up temp file before throwing
    try {
      unlinkSync(tempFilePath)
    } catch {
      // Ignore cleanup errors
    }
    throw new Error(
      `Failed to render markdown with crossnote: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  // Clean up temp markdown file (PDF is in a different location)
  try {
    unlinkSync(tempFilePath)
  } catch {
    // Ignore cleanup errors - temp files will be cleaned up by OS eventually
  }

  return outputPath
}
