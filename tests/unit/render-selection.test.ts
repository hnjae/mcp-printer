// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 KIM Hyunjae

/**
 * @fileoverview Which renderer a file gets: Markdown files are rendered as Markdown or printed as
 * they are, never silently rendered as code, and `render: none` prints any file as it is. Only
 * cases that need no Chrome are exercised.
 */

import { describe, expect, it, vi } from "bun:test"
import { join } from "node:path"

const fixtures = join(import.meta.dir, "../fixtures")

vi.mock("../../src/config.js", () => ({
  config: {
    allowedPaths: [fixtures],
    deniedPaths: [],
    autoRenderMarkdown: true,
    autoRenderCode: true,
    fallbackOnRenderError: false,
  },
  MARKDOWN_EXTENSIONS: ["md", "markdown"],
}))

import { shouldRenderCode } from "../../src/renderers/code.js"
import { prepareFileForPrinting } from "../../src/utils.js"

describe("code rendering selection", () => {
  it("does not pick Markdown files, which are recognized as code only for highlighting", async () => {
    expect(await shouldRenderCode(join(fixtures, "markdown-test-short.md"))).toBe(false)
    expect(await shouldRenderCode("notes.markdown")).toBe(false)
  })

  it("still picks ordinary code files", async () => {
    expect(await shouldRenderCode(join(fixtures, "hello.py"))).toBe(true)
  })
})

describe("render: none", () => {
  it("prints a Markdown file as it is instead of rendering it as code", async () => {
    const file = join(fixtures, "markdown-test-short.md")

    const prepared = await prepareFileForPrinting({ filePath: file, render: "none" })

    expect(prepared.actualFilePath).toBe(file)
    expect(prepared.renderedPdf).toBeNull()
    expect(prepared.renderType).toBe("")
  })

  it("prints a code file as it is", async () => {
    const file = join(fixtures, "hello.py")

    const prepared = await prepareFileForPrinting({ filePath: file, render: "none" })

    expect(prepared.actualFilePath).toBe(file)
    expect(prepared.renderType).toBe("")
  })
})
