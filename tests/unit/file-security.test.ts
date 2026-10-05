// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2025 Steve CLARKE
// SPDX-FileCopyrightText: 2026 KIM Hyunjae

/**
 * @fileoverview Unit tests for file security validation
 */

import { describe, expect, it, mock } from "bun:test"
import { homedir } from "node:os"

const configModulePath = "../../src/config.js"
const actualPath = await import("node:path")

function createDefaultConfigMock() {
  const homeDir = homedir()
  return {
    config: {
      allowedPaths: [homeDir],
      deniedPaths: [
        actualPath.posix.join(homeDir, ".ssh"),
        actualPath.posix.join(homeDir, ".gnupg"),
        actualPath.posix.join(homeDir, ".aws"),
        "/etc",
        "/var",
        "/root",
      ],
    },
  }
}

mock.module(configModulePath, createDefaultConfigMock)

type WindowsConfig = {
  allowedPaths: string[]
  deniedPaths: string[]
}

async function importFileSecurityWithWindows(config: WindowsConfig) {
  const win = actualPath.win32
  mock.module("path", () => ({
    ...win,
    sep: "\\",
    posix: actualPath.posix,
    win32: win,
  }))
  mock.module(configModulePath, () => ({ config }))

  const module = await import("../../src/file-security.js")

  return {
    ...module,
    restore() {
      mock.module("path", () => actualPath)
      mock.module(configModulePath, createDefaultConfigMock)
    },
  }
}

describe("validateFilePath", () => {
  it("should allow files under home directory", async () => {
    const { validateFilePath } = await import("../../src/file-security.js")
    const homeDir = homedir()
    const testPath = actualPath.posix.join(homeDir, "Documents", "test.txt")

    expect(() => validateFilePath(testPath)).not.toThrow()
  })

  it("should deny files in sensitive directories via dotfile blocking", async () => {
    const { validateFilePath } = await import("../../src/file-security.js")
    const homeDir = homedir()

    expect(() => validateFilePath(actualPath.posix.join(homeDir, ".ssh", "id_rsa"))).toThrow(
      /Dotfiles and hidden directories/
    )
    expect(() =>
      validateFilePath(actualPath.posix.join(homeDir, ".gnupg", "private-keys"))
    ).toThrow(/Dotfiles and hidden directories/)
    expect(() => validateFilePath(actualPath.posix.join(homeDir, ".aws", "credentials"))).toThrow(
      /Dotfiles and hidden directories/
    )
  })

  it("should deny all .env files anywhere via dotfile blocking", async () => {
    const { validateFilePath } = await import("../../src/file-security.js")
    const homeDir = homedir()

    expect(() => validateFilePath(actualPath.posix.join(homeDir, "projects", ".env"))).toThrow(
      /Dotfiles and hidden directories/
    )
    expect(() =>
      validateFilePath(actualPath.posix.join(homeDir, "projects", ".env.local"))
    ).toThrow(/Dotfiles and hidden directories/)
    expect(() =>
      validateFilePath(actualPath.posix.join(homeDir, "projects", ".env.production"))
    ).toThrow(/Dotfiles and hidden directories/)
  })

  it("should deny files in system directories", async () => {
    const { validateFilePath } = await import("../../src/file-security.js")

    expect(() => validateFilePath("/etc/passwd")).toThrow(/Access denied/)
    expect(() => validateFilePath("/var/log/system.log")).toThrow(/Access denied/)
    expect(() => validateFilePath("/root/secret.txt")).toThrow(/Access denied/)
  })

  it("should deny files outside allowed paths with helpful error", async () => {
    mock.module(configModulePath, () => ({
      config: {
        allowedPaths: ["/home/testuser/allowed"],
        deniedPaths: [],
      },
    }))

    try {
      const { validateFilePath } = await import("../../src/file-security.js")
      expect(() => validateFilePath("/tmp/test.txt")).toThrow(
        /outside allowed directories.*MCP_PRINTER_ALLOWED_PATHS/
      )
    } finally {
      mock.module(configModulePath, createDefaultConfigMock)
    }
  })

  it("should deny subdirectories of denied paths", async () => {
    const { validateFilePath } = await import("../../src/file-security.js")
    const homeDir = homedir()

    const deepSshPath = actualPath.posix.join(homeDir, ".ssh", "subfolder", "key.pem")
    expect(() => validateFilePath(deepSshPath)).toThrow(/Access denied/)
  })
})

describe("cross-platform path handling - Windows simulation", () => {
  it("should detect dotfiles in Windows-style paths", async () => {
    const { validateFilePath, restore } = await importFileSecurityWithWindows({
      allowedPaths: ["C:\\Users\\alice"],
      deniedPaths: [],
    })

    try {
      expect(() => validateFilePath("C:\\Users\\alice\\.env")).toThrow(
        /Dotfiles and hidden directories/
      )
      expect(() => validateFilePath("C:\\Users\\alice\\.ssh\\id_rsa")).toThrow(
        /Dotfiles and hidden directories/
      )
      expect(() => validateFilePath("C:\\Users\\alice\\Documents\\.secret")).toThrow(
        /Dotfiles and hidden directories/
      )
      expect(() => validateFilePath("C:\\Users\\alice\\.config\\app\\settings.json")).toThrow(
        /Dotfiles and hidden directories/
      )
    } finally {
      restore()
    }
  })

  it("should allow normal Windows paths without dotfiles", async () => {
    const { validateFilePath, restore } = await importFileSecurityWithWindows({
      allowedPaths: ["C:\\Users\\alice\\Documents"],
      deniedPaths: [],
    })

    try {
      expect(() => validateFilePath("C:\\Users\\alice\\Documents\\report.pdf")).not.toThrow()
      expect(() => validateFilePath("C:\\Users\\alice\\Documents\\folder\\file.txt")).not.toThrow()
    } finally {
      restore()
    }
  })

  it("should correctly check path prefixes with Windows backslashes", async () => {
    const { validateFilePath, restore } = await importFileSecurityWithWindows({
      allowedPaths: ["C:\\Users\\alice\\Documents"],
      deniedPaths: ["C:\\Users\\alice\\Documents\\private"],
    })

    try {
      expect(() => validateFilePath("C:\\Users\\alice\\Documents\\report.pdf")).not.toThrow()
      expect(() => validateFilePath("C:\\Users\\alice\\Documents\\private\\secret.txt")).toThrow(
        /restricted directory/
      )
      expect(() => validateFilePath("C:\\Users\\alice\\Downloads\\file.pdf")).toThrow(
        /outside allowed directories/
      )
    } finally {
      restore()
    }
  })
})
