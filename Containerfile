# SPDX-License-Identifier: AGPL-3.0-or-later
# SPDX-FileCopyrightText: 2026 KIM Hyunjae

# Sarasa Mono K, the code font: Hangul is exactly twice as wide as Latin, so code with Korean
# comments stays aligned. Debian does not package it, and the release is a .7z, so it is unpacked
# in a stage of its own and only the four styles used for code reach the image.
FROM docker.io/oven/bun:1-debian AS sarasa
# hadolint ignore=DL3008
RUN apt-get update \
    && apt-get install -y --no-install-recommends 7zip \
    && rm -rf /var/lib/apt/lists/*
ADD --checksum=sha256:e690a0caeb8fc13d33caa5c16d2bfb61b2847e99ddc2a884b4f925c56f358a9a \
    https://github.com/be5invis/Sarasa-Gothic/releases/download/v1.0.42/SarasaMonoK-TTF-1.0.42.7z \
    /tmp/SarasaMonoK.7z
ADD --checksum=sha256:32c932e0dbae4f6e6386964bbc2d04178707665a05ca65cf636241af13d50a53 \
    https://raw.githubusercontent.com/be5invis/Sarasa-Gothic/v1.0.42/LICENSE \
    /fonts/LICENSE
RUN 7z e -o/fonts /tmp/SarasaMonoK.7z \
    SarasaMonoK-Regular.ttf SarasaMonoK-Bold.ttf SarasaMonoK-Italic.ttf SarasaMonoK-BoldItalic.ttf

FROM docker.io/oven/bun:1-debian
# cups-bsd provides lpr/lpq/lprm, cups-client provides lpstat/lpoptions. Versions stay unpinned
# (DL3008): Debian drops superseded package versions, so pins would break rebuilds.
# hadolint ignore=DL3008
RUN apt-get update \
    && apt-get install -y --no-install-recommends cups-client cups-bsd chromium fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*
# The font is under the SIL Open Font License, which asks for its text to travel with the font.
COPY --from=sarasa --chmod=0644 /fonts/*.ttf /usr/local/share/fonts/sarasa-mono-k/
COPY --from=sarasa --chmod=0644 /fonts/LICENSE /usr/share/licenses/sarasa-mono-k/LICENSE
RUN fc-cache -f
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY src ./src

# The HTTP transport has no authentication: publish the port only to loopback or an internal
# network behind an authenticating proxy. Chrome keeps its sandbox as the non-root user; set
# MCP_PRINTER_CHROME_NO_SANDBOX=true if the runtime forbids it or the container runs as root.
# Nothing is mounted by default, so the tools that read server paths are hidden; set
# MCP_PRINTER_ENABLE_FILE_TOOLS=true when you mount documents.
ENV MCP_PRINTER_TRANSPORT=http \
    MCP_PRINTER_HTTP_HOST=0.0.0.0 \
    MCP_PRINTER_HTTP_PORT=3000 \
    MCP_PRINTER_ENABLE_FILE_TOOLS=false
USER bun
EXPOSE 3000
CMD ["bun", "src/index.ts"]
