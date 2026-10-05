<!--
SPDX-License-Identifier: AGPL-3.0-or-later
SPDX-FileCopyrightText: 2026 KIM Hyunjae
-->

# Source Release Process

This fork is maintained from source and is intentionally not published to npm. The fork has no release tags or release artifacts yet; upstream tags do not identify builds of this fork.

## Build from source

```sh
git clone 'https://github.com/hnjae/mcp-printer.git'
cd mcp-printer
bun install --frozen-lockfile
just build
```

Configure an MCP client to run `bun` with the absolute path to `dist/index.js`. See the installation section in the [README](../README.md).

## Create a GitHub source release

Before creating a release on the fork:

1. Update `CHANGELOG.md` for the changes being released.
2. Update the `package.json` version to match the fork release tag.
3. Run `just lint`, `just format-check`, `just test`, `just build`, and `reuse lint`.
4. Create a version tag on the fork and push the release commit and tag to `origin`.
5. Create a GitHub release from that tag at <https://github.com/hnjae/mcp-printer/releases>.
6. Confirm the release source archive includes `LICENSE`, `LICENSES/`, and `README.md`.

The `package.json` version is used in the MCP server's reported version. It does not indicate that a fork release exists. Use Bun to install and run this fork from source.
