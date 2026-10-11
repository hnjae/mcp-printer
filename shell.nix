# SPDX-License-Identifier: AGPL-3.0-or-later
# SPDX-FileCopyrightText: 2026 KIM Hyunjae
{
  pkgs ? import <nixpkgs> { },
}:
pkgs.mkShellNoCC {
  packages = with pkgs; [
    actionlint
    bun
    chromium
    cocogitto
    cups
    editorconfig-checker
    hadolint
    just
    nixfmt
    prek
    reuse
    rumdl
    taplo
    treefmt
    typos
    yamlfmt
  ];

  shellHook = ''
    just hooks-install
  '';
}
