// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 Steve CLARKE
// SPDX-FileCopyrightText: 2026 KIM Hyunjae

/**
 * @fileoverview Print tool registration.
 * Registers print_content and print_pdf (document sent by the client) and print_file and
 * get_page_meta (document read from a path on the server) with the MCP server.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { ORIENTATIONS, QUALITIES, SIDES } from "../print-settings.js"
import { CONTENT_FORMATS, MAX_PDF_BYTES, RENDER_MODES } from "../utils.js"
import {
  checkBatchSizeLimit,
  formatPageMetaResults,
  formatPrintResults,
  handlePageMeta,
  handlePrint,
  handlePrintContent,
  handlePrintPdf,
  type PageMetaResult,
  type PrintResult,
} from "./batch-helpers.js"

/**
 * Shared parameter schema for rendering options used by both print_file and get_page_meta.
 */
const renderingParametersSchema = {
  line_numbers: z
    .boolean()
    .optional()
    .describe("Show line numbers when rendering code files (overrides global setting)"),
  color_scheme: z
    .string()
    .optional()
    .describe(
      "Syntax highlighting color scheme for code files (e.g., 'github', 'monokai', 'atom-one-light')"
    ),
  font_size: z
    .string()
    .optional()
    .describe("Font size for code files (e.g., '8pt', '10pt', '12pt')"),
  line_spacing: z
    .string()
    .optional()
    .describe("Line spacing for code files (e.g., '1', '1.5', '2')"),
  render: z
    .enum(RENDER_MODES)
    .optional()
    .describe(
      "How to render the file: 'markdown' or 'code' renders it to PDF as that kind of document whatever its extension, 'none' uses the file as it is. Omit to detect from the extension and the server configuration."
    ),
}

/**
 * Typed print settings shared by every tool that submits a job. They take precedence over `options`.
 */
const printSettingsSchema = {
  sides: z
    .enum(SIDES)
    .optional()
    .describe(
      "Single- or double-sided printing: 'one-sided', 'two-sided-long-edge' (flips on the long edge, the usual book/report layout) or 'two-sided-short-edge'. Overrides the server's default duplex setting."
    ),
  media: z
    .string()
    .regex(/^[^\s=]+$/, "Must not contain whitespace or '='")
    .optional()
    .describe(
      "Paper size, e.g. 'A4' or 'Letter'. Accepted names depend on the printer: list_printers shows them, including 'jis_b5_182x257mm', 'jis_b6_128x182mm' and Custom.<W>x<H>mm where supported."
    ),
  orientation: z
    .enum(ORIENTATIONS)
    .optional()
    .describe("Page orientation: 'portrait' or 'landscape'"),
  quality: z
    .enum(QUALITIES)
    .optional()
    .describe(
      "Print quality: 'draft', 'normal' or 'high' (CUPS cupsPrintQuality). Not every printer supports it."
    ),
  options: z
    .string()
    .optional()
    .describe(
      "Other CUPS options as a space-separated string (e.g., 'number-up=2'). Use sides, media, orientation and quality for those settings instead."
    ),
}

/**
 * Maximum length of the content accepted by print_content, in characters.
 */
const MAX_CONTENT_LENGTH = 1_000_000

/**
 * Maximum length of the base64 text accepted by print_pdf (base64 encodes 3 bytes in 4 characters).
 */
const MAX_PDF_BASE64_LENGTH = Math.ceil((MAX_PDF_BYTES * 4) / 3) + 4

/**
 * Registers the tools that receive the document from the client: print_content and print_pdf.
 *
 * @param server - The McpServer instance to register the tools with
 */
export function registerContentPrintTools(server: McpServer) {
  // Register print_content tool
  server.registerTool(
    "print_content",
    {
      title: "Print Content",
      description:
        "Print a document whose text you provide, without needing a file on the server. Use it to print text you wrote: markdown is rendered to PDF with formatting (tables, math, mermaid diagrams), html is rendered as a self-contained page (inline CSS and data: images only; no scripts, no external or local resources), code is rendered with syntax highlighting, and text is printed as plain text.",
      inputSchema: {
        content: z.string().min(1).max(MAX_CONTENT_LENGTH).describe("The document text to print"),
        format: z
          .enum(CONTENT_FORMATS)
          .describe("How to interpret the content: markdown, html, code or text"),
        language: z
          .string()
          .optional()
          .describe(
            "For format 'code': file extension or language id for syntax highlighting (e.g., 'py', 'ts'). Defaults to 'txt'."
          ),
        printer: z
          .string()
          .optional()
          .describe(
            "Printer name (use list_printers to see available printers). Optional if default printer is set."
          ),
        copies: z
          .number()
          .min(1)
          .optional()
          .default(1)
          .describe("Number of copies to print (default: 1)"),
        ...printSettingsSchema,
        skip_confirmation: z
          .boolean()
          .optional()
          .describe(
            "Skip page count confirmation check (bypasses MCP_PRINTER_CONFIRM_IF_OVER_PAGES threshold)"
          ),
        line_numbers: renderingParametersSchema.line_numbers,
        color_scheme: renderingParametersSchema.color_scheme,
        font_size: renderingParametersSchema.font_size,
        line_spacing: renderingParametersSchema.line_spacing,
      },
    },
    async (spec) => formatPrintResults([await handlePrintContent(spec)])
  )

  // Register print_pdf tool
  server.registerTool(
    "print_pdf",
    {
      title: "Print PDF",
      description:
        "Print a PDF file whose bytes you provide as base64, for PDFs that exist only on your side and not on the server. Only practical for small PDFs because you must write out the whole base64 text; prefer print_content when you can supply the document as markdown or html.",
      inputSchema: {
        pdf_base64: z
          .string()
          .min(1)
          .max(MAX_PDF_BASE64_LENGTH)
          .describe("The PDF file contents encoded as base64"),
        printer: z
          .string()
          .optional()
          .describe(
            "Printer name (use list_printers to see available printers). Optional if default printer is set."
          ),
        copies: z
          .number()
          .min(1)
          .optional()
          .default(1)
          .describe("Number of copies to print (default: 1)"),
        ...printSettingsSchema,
        skip_confirmation: z
          .boolean()
          .optional()
          .describe(
            "Skip page count confirmation check (bypasses MCP_PRINTER_CONFIRM_IF_OVER_PAGES threshold)"
          ),
      },
    },
    async (spec) => formatPrintResults([await handlePrintPdf(spec)])
  )
}

/**
 * Registers the tools that read documents from paths on the server: print_file and get_page_meta.
 * print_file supports automatic rendering of markdown and code files to PDF before printing and
 * accepts an array of files to print in batch operations.
 *
 * @param server - The McpServer instance to register the tools with
 */
export function registerFilePrintTools(server: McpServer) {
  server.registerTool(
    "print_file",
    {
      title: "Print File",
      description:
        "Print a file to a specified printer. Supports PDF, text, and other common formats. Can specify number of copies, sides, paper size (media), orientation and other CUPS options.",
      inputSchema: {
        files: z
          .array(
            z.object({
              file_path: z.string().describe("Full path to the file to print"),
              printer: z
                .string()
                .optional()
                .describe(
                  "Printer name (use list_printers to see available printers). Optional if default printer is set."
                ),
              copies: z
                .number()
                .min(1)
                .optional()
                .default(1)
                .describe("Number of copies to print (default: 1)"),
              ...printSettingsSchema,
              skip_confirmation: z
                .boolean()
                .optional()
                .describe(
                  "Skip page count confirmation check (bypasses MCP_PRINTER_CONFIRM_IF_OVER_PAGES threshold)"
                ),
              ...renderingParametersSchema,
            })
          )
          .describe("Array of files to print (use single-element array for one file)"),
      },
    },
    async ({ files }) => {
      // Check for large batch size
      const batchSizeWarning = checkBatchSizeLimit(files.length, "files")
      if (batchSizeWarning) {
        return batchSizeWarning
      }

      // Process each file in the batch
      const results: PrintResult[] = []
      for (const fileSpec of files) {
        const result = await handlePrint(fileSpec)
        results.push(result)
      }

      return formatPrintResults(results)
    }
  )

  // Register get_page_meta tool
  server.registerTool(
    "get_page_meta",
    {
      title: "Get Page Metadata",
      description:
        "Get page count and physical sheet information for a file before printing. Pre-renders the file (if needed) and returns page metadata including page count and physical sheets required.",
      inputSchema: {
        files: z
          .array(
            z.object({
              file_path: z.string().describe("Full path to the file to get page metadata for"),
              sides: printSettingsSchema.sides,
              options: z
                .string()
                .optional()
                .describe(
                  "Additional CUPS options; only 'sides=' is used here, for duplex detection. Prefer the sides parameter."
                ),
              ...renderingParametersSchema,
            })
          )
          .describe("Array of files to get metadata for (use single-element array for one file)"),
      },
    },
    async ({ files }) => {
      // Check for large batch size
      const batchSizeWarning = checkBatchSizeLimit(files.length, "files")
      if (batchSizeWarning) {
        return batchSizeWarning
      }

      // Process each file in the batch
      const results: PageMetaResult[] = []
      for (const fileSpec of files) {
        const result = await handlePageMeta(fileSpec)
        results.push(result)
      }

      return formatPageMetaResults(results)
    }
  )
}
