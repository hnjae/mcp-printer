<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- SPDX-FileCopyrightText: 2026 KIM Hyunjae -->

# GitHub Source Release Checklist

This fork is source-only and is not published to npm. There are no fork-owned release tags or artifacts yet.

## Before the release

- [ ] Update `CHANGELOG.md` with the changes being released.
- [ ] Set the `package.json` version to match the fork release tag.
- [ ] Run `just lint`.
- [ ] Run `just format-check`.
- [ ] Run `just test`.
- [ ] Run `just build`.
- [ ] Run `reuse lint`.
- [ ] Confirm the working tree is clean and the release commit is on `main`.

## Publish a source release

1. Create a version tag on the fork, using a version that identifies this fork's release.
2. Push the release commit and tag to `origin`.
3. Create a GitHub release from the tag at <https://github.com/hnjae/mcp-printer/releases>.
4. Confirm the generated source archive contains `LICENSE`, `LICENSES/`, and `README.md`.
5. Verify the release notes link to the fork and describe the source-build installation path.

GitHub releases and tags require a fork-owned release to be created. Upstream tags and npm packages are not releases of this fork.
