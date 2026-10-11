# Prompts

The server offers one prompt, `print-changed`, which a client can present as a command. It is registered only when file tools are enabled ([tool-availability](tool-availability.md)).

Arguments:

- `context` (required): `staged`, `uncommitted`, `branch`, or the name of a branch.
- `options` (optional): print settings in the user's words, such as `landscape` or `A4`.

The prompt is an instruction to the assistant: find the files changed in the given context with git (staged changes, unstaged changes, or the diff of the current or named branch against `main`), print each with `print_file` using consistent print settings, and report which files were printed or skipped. The server runs no git commands itself, so the client must be able to discover the files, and the files must be allowed by [file-access](file-access.md).
