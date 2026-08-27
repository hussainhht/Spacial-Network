package migrations

import "embed"

// Files contains the SQLite migration scripts needed at runtime.
//
//go:embed *.sql
var Files embed.FS
