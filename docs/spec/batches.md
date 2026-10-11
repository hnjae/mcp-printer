# Batches

`print_file` and `get_page_meta` take a `files` array and `cancel_print_job` takes a `jobs` array, even for a single item. `print_content` and `print_pdf` handle one document per call.

A call may contain at most 50 items. A larger call is not processed; it returns a warning that tells the assistant to ask the user whether to proceed or to split the work into several calls of at most 50.

Items are processed one at a time in the order given. A failing item does not stop the rest. The response summarizes how many items succeeded and failed, and reports each item's outcome or failure reason.
