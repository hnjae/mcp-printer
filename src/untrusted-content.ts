// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 KIM Hyunjae

/**
 * @fileoverview Hardening for document content that arrives from an MCP client (print_content).
 *
 * File-based printing trusts the file because its path passed validateFilePath. Content sent by a
 * remote client has no such gate, and the renderers can read or write local files on its behalf:
 * - HTML in Chrome can embed local files with iframe/object.
 * - crossnote resolves @import and standalone image lines relative to the temp dir, so `..`
 *   escapes it and the target file is printed into the PDF.
 * - crossnote spreads front-matter `chrome:`/`puppeteer:` over page.pdf() options, which includes
 *   the output `path`.
 * - gray-matter evaluates `---js` front matter.
 *
 * Markdown is neutralized by inserting an invisible zero-width space into the constructs the
 * renderers recognize, so the text still prints but no longer triggers them.
 */

import matter from "gray-matter"

const ZERO_WIDTH_SPACE = "​"

/** Chrome rejects every load except inline styles and data: images/fonts. */
const HTML_CONTENT_SECURITY_POLICY =
  "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:"

/** Tags that embed another document or reconfigure loading. */
const EMBEDDING_TAGS = "iframe|frame|frameset|object|embed|portal|fencedframe|script|link|meta|base"

/** Front matter opened with a language specifier, such as "---js", selects a non-YAML engine. */
const FRONT_MATTER_WITH_ENGINE = /^\uFEFF?---(?!-)[ \t]*\S/

/**
 * Restricts a client-supplied HTML document to self-contained content by prepending a
 * Content-Security-Policy. The policy goes after any doctype so the document stays out of quirks mode.
 * Client <meta> tags are removed because a refresh can navigate to a local file, which the policy
 * does not cover; a charset declaration replaces them.
 *
 * @param html - HTML document or fragment from the client
 * @returns HTML that cannot load local files, network resources or run scripts
 */
export function hardenHtml(html: string): string {
  const head = `<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${HTML_CONTENT_SECURITY_POLICY}">`
  const withoutMeta = html.replace(/<meta\b[^>]*>/gi, "")
  const doctype = withoutMeta.match(/^\s*<!doctype[^>]*>/i)
  if (!doctype) {
    return head + withoutMeta
  }
  return doctype[0] + head + withoutMeta.slice(doctype[0].length)
}

/**
 * Rejects front matter that selects a code-evaluating engine. gray-matter evaluates "---js"
 * (or "---javascript") front matter as code, so this must run before any matter() call on
 * content that is not fully trusted.
 *
 * @param markdown - Markdown to check
 * @throws {Error} If the front matter selects a non-YAML engine
 */
export function assertNoFrontMatterEngine(markdown: string): void {
  if (FRONT_MATTER_WITH_ENGINE.test(markdown)) {
    throw new Error("Front matter with a language specifier (for example '---js') is not allowed")
  }
}

/**
 * Neutralizes constructs in client-supplied markdown that make the renderers touch local files
 * or execute code, keeping the visible text unchanged.
 *
 * @param markdown - Markdown from the client
 * @returns Markdown that is safe to hand to renderMarkdownToPdf
 * @throws {Error} If the front matter selects a non-YAML engine (for example `---js`)
 */
export function sanitizeUntrustedMarkdown(markdown: string): string {
  assertNoFrontMatterEngine(markdown)

  // Drop front matter that controls the PDF output path and Chrome page options
  let result = markdown
  const { data, content } = matter(markdown)
  if ("chrome" in data || "puppeteer" in data) {
    const { chrome: _chrome, puppeteer: _puppeteer, ...remaining } = data
    result = matter.stringify(content, remaining)
  }

  return (
    result
      // "@import" file inclusion, in every form crossnote accepts
      .replace(/@import/g, `@${ZERO_WIDTH_SPACE}import`)
      // "![[file]]" embeds
      .replace(/!\[\[/g, `![${ZERO_WIDTH_SPACE}[`)
      // A line holding only an image is treated as a file import, also inside blockquotes
      .replace(/^([\s>]*!\[[^\]]*\]\([^)]+\)(?:\{[^}]*\})?)(\s*)$/gm, `$1${ZERO_WIDTH_SPACE}$2`)
      // Raw HTML that embeds documents
      .replace(new RegExp(`<(?=/?(?:${EMBEDDING_TAGS})\\b)`, "gi"), `<${ZERO_WIDTH_SPACE}`)
  )
}
