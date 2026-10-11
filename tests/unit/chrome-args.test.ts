// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 KIM Hyunjae

/**
 * @fileoverview Contract tests for the Chrome launch arguments derived from configuration.
 */

import { afterEach, describe, expect, it } from "bun:test"
import { config } from "../../src/config.js"
import { getChromeSandboxArgs } from "../../src/utils.js"

const original = config.chromeNoSandbox

afterEach(() => {
  config.chromeNoSandbox = original
})

describe("getChromeSandboxArgs", () => {
  it("keeps the Chrome sandbox by default", () => {
    config.chromeNoSandbox = false

    expect(getChromeSandboxArgs()).toEqual([])
  })

  it("disables the sandbox when MCP_PRINTER_CHROME_NO_SANDBOX is enabled", () => {
    config.chromeNoSandbox = true

    expect(getChromeSandboxArgs()).toEqual(["--no-sandbox"])
  })
})
