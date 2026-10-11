// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 KIM Hyunjae

/**
 * @fileoverview Client-supplied content must not make the renderers read or write local files.
 * Each case renders adversarial input through the real Chrome pipeline and checks the PDF.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { PDFParse } from "pdf-parse"

vi.mock("../../src/config.ts", () => ({
  config: {
    allowedPaths: [],
    deniedPaths: [],
    autoRenderMarkdown: true,
    chromePath: "",
    code: {
      colorScheme: "atom-one-light",
      autoLineNumbers: true,
      fontSize: "10pt",
      lineSpacing: "1.5",
    },
  },
  MARKDOWN_EXTENSIONS: ["md", "markdown"],
}))

import { renderMarkdownToPdf } from "../../src/renderers/markdown.ts"
import { hardenHtml, sanitizeUntrustedMarkdown } from "../../src/untrusted-content.ts"
import { convertHtmlToPdf } from "../../src/utils.ts"

const SENTINEL = "SENTINEL-4c1e-DO-NOT-PRINT"
const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../tmp/untrusted")
const secretFile = join(fixtureDir, "secret.txt")
const overwriteTarget = join(fixtureDir, "must-not-be-created.pdf")

let workDir: string

beforeAll(() => {
  mkdirSync(fixtureDir, { recursive: true })
  writeFileSync(secretFile, SENTINEL)
  workDir = mkdtempSync(join(tmpdir(), "untrusted-test-"))
})

afterAll(() => {
  rmSync(fixtureDir, { recursive: true, force: true })
  rmSync(workDir, { recursive: true, force: true })
})

async function pdfText(pdfPath: string): Promise<string> {
  const parser = new PDFParse({ data: await Bun.file(pdfPath).bytes() })
  try {
    return (await parser.getText()).text
  } finally {
    await parser.destroy()
  }
}

async function renderClientMarkdown(name: string, markdown: string): Promise<string> {
  const file = join(workDir, `${name}.md`)
  writeFileSync(file, sanitizeUntrustedMarkdown(markdown))
  const pdf = await renderMarkdownToPdf(file)
  try {
    return await pdfText(pdf)
  } finally {
    rmSync(pdf, { force: true })
  }
}

describe("client markdown", () => {
  const traversal = () => relative(workDir, secretFile)

  const cases: Record<string, () => string> = {
    "@import": () => `@import "${traversal()}"`,
    "@import in a comment": () => `<!-- @import "${traversal()}" -->`,
    "@import in a quote": () => `> @import "${traversal()}"`,
    "standalone image line": () => `![x](${traversal()})`,
    "image line in a quote": () => `> ![x](${traversal()})`,
    "image line in a nested quote": () => `> > ![x](${traversal()})`,
    "![[embed]]": () => `![[${traversal()}]]`,
    iframe: () => `<iframe src="file://${secretFile}" width="600" height="100"></iframe>`,
    object: () =>
      `<object data="file://${secretFile}" type="text/plain" width="600" height="100"></object>`,
  }

  for (const [name, body] of Object.entries(cases)) {
    it(`does not print a local file through ${name}`, async () => {
      const text = await renderClientMarkdown(name.replace(/\W+/g, "-"), `# Heading\n\n${body()}\n`)

      expect(text).toContain("Heading")
      expect(text).not.toContain(SENTINEL)
    })
  }

  it("rejects code-evaluating front matter in any markdown file", async () => {
    const file = join(workDir, "engine.md")
    writeFileSync(file, "---js\n({ a: 1 })\n---\n\n# Heading\n")

    await expect(renderMarkdownToPdf(file)).rejects.toThrow(/language specifier/)
  })

  it("does not let front matter choose where the PDF is written", async () => {
    const text = await renderClientMarkdown(
      "front-matter",
      `---\nchrome:\n  path: ${overwriteTarget}\n---\n\n# Heading\n`
    )

    expect(text).toContain("Heading")
    expect(existsSync(overwriteTarget)).toBe(false)
  })
})

describe("client HTML", () => {
  const cases: Record<string, string> = {
    iframe: `<iframe src="file://${secretFile}" width="600" height="100"></iframe>`,
    object: `<object data="file://${secretFile}" type="text/plain" width="600" height="100"></object>`,
    "meta refresh": `<meta http-equiv="refresh" content="0;url=file://${secretFile}">`,
  }

  for (const [name, body] of Object.entries(cases)) {
    it(`does not print a local file through ${name}`, async () => {
      const pdf = await convertHtmlToPdf(
        hardenHtml(`<html><body><h1>Heading</h1>${body}</body></html>`)
      )
      try {
        const text = await pdfText(pdf)

        expect(text).toContain("Heading")
        expect(text).not.toContain(SENTINEL)
      } finally {
        rmSync(pdf, { force: true })
      }
    })
  }
})
