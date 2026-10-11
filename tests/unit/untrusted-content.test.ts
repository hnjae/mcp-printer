// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 KIM Hyunjae

/**
 * @fileoverview Contract tests for hardening client-supplied document content.
 */

import { describe, expect, it } from "bun:test"
import matter from "gray-matter"
import { hardenHtml, sanitizeUntrustedMarkdown } from "../../src/untrusted-content.ts"

const INVISIBLE = /​/g

describe("hardenHtml", () => {
  it("restricts the document with a Content-Security-Policy and keeps the content", () => {
    const result = hardenHtml("<h1>Report</h1>")

    expect(result).toContain("Content-Security-Policy")
    expect(result).toContain("default-src 'none'")
    expect(result).toContain("<h1>Report</h1>")
  })

  it("keeps the doctype first so the document is not rendered in quirks mode", () => {
    const result = hardenHtml("<!DOCTYPE html><html><body>x</body></html>")

    expect(result.startsWith("<!DOCTYPE html>")).toBe(true)
    expect(result).toContain("Content-Security-Policy")
  })
})

describe("sanitizeUntrustedMarkdown", () => {
  it("rejects front matter that selects a code-evaluating engine", () => {
    expect(() => sanitizeUntrustedMarkdown("---js\n({ a: 1 })\n---\nbody")).toThrow()
    expect(() => sanitizeUntrustedMarkdown("---javascript\n({ a: 1 })\n---\nbody")).toThrow()
  })

  it("accepts plain YAML front matter and horizontal rules", () => {
    expect(() => sanitizeUntrustedMarkdown("---\ntitle: Report\n---\n\nbody")).not.toThrow()
    expect(() => sanitizeUntrustedMarkdown("text\n\n---\n\nmore")).not.toThrow()
  })

  it("removes front matter that controls Chrome and the output path", () => {
    const result = sanitizeUntrustedMarkdown(
      "---\ntitle: Report\nchrome:\n  path: /tmp/elsewhere.pdf\npuppeteer:\n  format: A3\n---\n\nbody\n"
    )

    const { data } = matter(result)
    expect(data.title).toBe("Report")
    expect(data.chrome).toBeUndefined()
    expect(data.puppeteer).toBeUndefined()
  })

  it("keeps the visible text when neutralizing file-touching constructs", () => {
    const original = [
      "# Title",
      "",
      '@import "../../secret.txt"',
      "",
      "![[../../secret.txt]]",
      "",
      "![diagram](../../secret.png)",
      "",
      '<iframe src="file:///etc/passwd"></iframe>',
      "",
      "plain paragraph",
    ].join("\n")

    const result = sanitizeUntrustedMarkdown(original)

    expect(result).not.toBe(original)
    expect(result.replace(INVISIBLE, "")).toBe(original)
  })

  it("leaves ordinary markdown untouched", () => {
    const original =
      "# Title\n\n- item\n\n![logo](https://example.com/a.png) inline\n\n```ts\nconst a = 1\n```\n"

    expect(sanitizeUntrustedMarkdown(original)).toBe(original)
  })
})
