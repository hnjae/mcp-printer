# File access

`print_file` and `get_page_meta` read paths on the server's file system. Every such path is checked once, before anything is read or rendered. `print_content` and `print_pdf` take their document from the call and read no server paths.

A path is allowed only if all of these hold:

1. No component of the path starts with `.`, in the path as given or after symlinks are resolved. Dotfiles and hidden directories cannot be printed, and no setting changes this.
2. The resolved path is not inside a denied path. The denied paths are the built-in list plus `MCP_PRINTER_DENIED_PATHS`. The built-in list holds credential directories (`~/.ssh`, `~/.gnupg`, `~/.aws`, `~/.config/gcloud`) and system directories (`/bin`, `/sbin`, `/lib`, `/lib64`, `/usr/lib`, `/usr/sbin`, `/boot`, `/dev`, `/etc`, `/proc`, `/run`, `/sys`, `/var`, `/tmp`, `/root`, and on macOS `/System`, `/Library`, `/private/etc`, `/private/var`, `/private/tmp`). Denial wins over allowing, and the built-in entries cannot be allowed.
3. The resolved path is inside an allowed path: `MCP_PRINTER_ALLOWED_PATHS`, a colon-separated list, default `~/Documents:~/Downloads:~/Desktop`. A nonempty value replaces the default list.

`~` at the start of an entry and `$HOME` or `${HOME}` anywhere in it expand to the home directory.

A path that fails the check fails its own item with an explanation of which rule applied; the other items are unaffected.

The check covers the document a tool is asked to print. It does not cover resources a renderer embeds from that document; see [untrusted-content](untrusted-content.md).
