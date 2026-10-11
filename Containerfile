# SPDX-License-Identifier: AGPL-3.0-or-later
# SPDX-FileCopyrightText: 2026 KIM Hyunjae

FROM docker.io/oven/bun:1-debian
# cups-bsd provides lpr/lpq/lprm, cups-client provides lpstat/lpoptions. Versions stay unpinned
# (DL3008): Debian drops superseded package versions, so pins would break rebuilds.
# hadolint ignore=DL3008
RUN apt-get update \
    && apt-get install -y --no-install-recommends cups-client cups-bsd chromium fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*
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
