# How to open `schema.dbml`

## What is DBML?

DBML (Database Markup Language) is a plain-text DSL for describing a database
schema — tables, columns, types, constraints, and foreign keys — as code
instead of drawing it in a GUI. It's the format used by
[dbdiagram.io](https://dbdiagram.io).

It's useful for:

- Documenting the schema in version control (readable diffs, no binary files).
- Auto-generating a visual ER diagram from that text.
- Sharing/reviewing schema design before writing migrations.

[schema.dbml](schema.dbml) in this folder is this project's database schema
written in DBML.

## Option 1: VS Code extension

Install one of these from the Extensions panel (`Ctrl+Shift+X`):

- **vscode-dbml** (Matt Meyers) — syntax highlighting for `.dbml` files.
- **DBML Live Preview** (bocovo) — renders the schema as a live ER diagram
  inside VS Code.

Steps:

1. Install the extension(s) above.
2. Open `schema.dbml` in the editor.
3. Open the Command Palette (`Ctrl+Shift+P`) → run **"DBML: Open Preview"**
   (or click the preview icon in the top-right of the editor tab).
4. A rendered ER diagram opens side-by-side and updates live as you edit.

## Option 2: dbdiagram.io (no install needed)

`schema.dbml` is written for dbdiagram.io. Just paste its contents into
[dbdiagram.io](https://dbdiagram.io) to get the same interactive diagram in
the browser.
