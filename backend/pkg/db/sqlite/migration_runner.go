package sqlite

import (
	"database/sql"
	"fmt"
)

const createSchemaMigrationsTable = `
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);`

func ensureSchemaMigrationsTable(db *sql.DB) error {
	_, err := db.Exec(createSchemaMigrationsTable)
	return err
}

func appliedVersions(db *sql.DB) (map[int64]bool, error) {
	rows, err := db.Query(`SELECT version FROM schema_migrations`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	applied := make(map[int64]bool)
	for rows.Next() {
		var version int64
		if err := rows.Scan(&version); err != nil {
			return nil, err
		}
		applied[version] = true
	}

	return applied, rows.Err()
}

func latestApplied(db *sql.DB) (migration, bool, error) {
	var m migration
	err := db.QueryRow(`
		SELECT version, name FROM schema_migrations
		ORDER BY version DESC LIMIT 1
	`).Scan(&m.version, &m.name)
	if err == sql.ErrNoRows {
		return migration{}, false, nil
	}
	if err != nil {
		return migration{}, false, err
	}

	if m.version < 1000000 {
		m.rawVersion = fmt.Sprintf("%06d", m.version)
	} else {
		m.rawVersion = fmt.Sprintf("%d", m.version)
	}

	return m, true, nil
}

func runMigrationUp(db *sql.DB, m migration) error {
	content, err := migrationFiles.ReadFile(m.upFile())
	if err != nil {
		return err
	}

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(string(content)); err != nil {
		return err
	}

	if _, err := tx.Exec(
		`INSERT INTO schema_migrations (version, name) VALUES (?, ?)`,
		m.version, m.name,
	); err != nil {
		return err
	}

	return tx.Commit()
}

func runMigrationDown(db *sql.DB, m migration) error {
	content, err := migrationFiles.ReadFile(m.downFile())
	if err != nil {
		return err
	}

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(string(content)); err != nil {
		return err
	}

	if _, err := tx.Exec(`DELETE FROM schema_migrations WHERE version = ?`, m.version); err != nil {
		return err
	}

	return tx.Commit()
}
