# Untrusted content

Text sent through `print_content` comes from the client and is treated as untrusted: rendering it must not read or write files on the server or load resources from the network. Documents printed with `print_file` are the operator's own files, limited by [file-access](file-access.md), and are rendered without this treatment.

## HTML

HTML is rendered as a self-contained page. Inline styles and `data:` images and fonts work. Scripts, and any external or local resource, are blocked, and `<meta>` tags in the input are dropped so the input cannot relax this.

## Markdown

Markdown input is rendered with these restrictions:

- Front matter that names a language or engine, such as `---js`, is rejected, because it would be evaluated as code. This applies to Markdown files printed with `print_file` as well.
- Front matter keys `chrome` and `puppeteer`, which control the PDF output, are dropped.
- File-inclusion directives are disabled: `@import`, `![[file]]`, and a line holding only an image, also inside blockquotes.
- Raw HTML tags that embed other documents or run code are disabled: `iframe`, `frame`, `frameset`, `object`, `embed`, `portal`, `fencedframe`, `script`, `link`, `meta` and `base`.
- Code blocks are never executed.

An inline image written with ordinary Markdown syntax inside text is still rendered, so Markdown from a client can print image files the server process can read. Operators who cannot accept this should run the server with access only to files they are willing to expose.

## Text and code

`text` is escaped and `code` is highlighted; neither is interpreted as markup.
