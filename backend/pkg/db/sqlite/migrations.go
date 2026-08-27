package sqlite

import (
	"database/sql"
	"fmt"
)

func MigrateUp(db *sql.DB) error {
	if err := ensureSchemaMigrationsTable(db); err != nil {
		return fmt.Errorf("ensure schema_migrations table: %w", err)
	}

	migrations, err := loadMigrations()
	if err != nil {
		return fmt.Errorf("load migrations: %w", err)
	}

	applied, err := appliedVersions(db)
	if err != nil {
		return fmt.Errorf("read applied migrations: %w", err)
	}

	for _, m := range migrations {
		if applied[m.version] {
			continue
		}

		if err := runMigrationUp(db, m); err != nil {
			return fmt.Errorf("migration %s: %w", m.upFile(), err)
		}
	}

	return nil
}

func MigrateDown(db *sql.DB) error {
	if err := ensureSchemaMigrationsTable(db); err != nil {
		return fmt.Errorf("ensure schema_migrations table: %w", err)
	}

	m, ok, err := latestApplied(db)
	if err != nil {
		return fmt.Errorf("read latest migration: %w", err)
	}
	if !ok {
		return nil
	}

	if err := runMigrationDown(db, m); err != nil {
		return fmt.Errorf("migration %s: %w", m.downFile(), err)
	}

	return nil
}

func MigrateDownAll(db *sql.DB) error {
	if err := ensureSchemaMigrationsTable(db); err != nil {
		return fmt.Errorf("ensure schema_migrations table: %w", err)
	}

	for {
		m, ok, err := latestApplied(db)
		if err != nil {
			return fmt.Errorf("read latest migration: %w", err)
		}
		if !ok {
			return nil
		}

		if err := runMigrationDown(db, m); err != nil {
			return fmt.Errorf("migration %s: %w", m.downFile(), err)
		}
	}
}

func MigrationVersion(db *sql.DB) (int64, error) {
	if err := ensureSchemaMigrationsTable(db); err != nil {
		return 0, fmt.Errorf("ensure schema_migrations table: %w", err)
	}

	var version sql.NullInt64
	if err := db.QueryRow(`SELECT MAX(version) FROM schema_migrations`).Scan(&version); err != nil {
		return 0, err
	}
	if !version.Valid {
		return 0, nil
	}

	return version.Int64, nil
}
