package sqlite

import (
	"database/sql"
	"os"
	"path/filepath"
	"sort"
	"strings"

	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

const migrationsDir = "pkg/db/migrations/sqlite"

func Open(dirPath, fileName string) (*sql.DB, error) {
	if err := os.MkdirAll(dirPath, 0o755); err != nil {
		return nil, err
	}

	db, err := sql.Open("sqlite3", filepath.Join(dirPath, fileName))
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		return nil, err
	}

	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)

	DB = db
	return DB, nil
}

func RunMigrations(db *sql.DB) error {
	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		return err
	}

	var files []string
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".up.sql") {
			files = append(files, entry.Name())
		}
	}
	sort.Strings(files)

	for _, name := range files {
		content, err := os.ReadFile(filepath.Join(migrationsDir, name))
		if err != nil {
			return err
		}
		if _, err := db.Exec(string(content)); err != nil {
			return err
		}
	}

	return enforceBinaryGenderValues(db)
}

func enforceBinaryGenderValues(db *sql.DB) error {
	var unsupportedCount int
	return db.QueryRow(`
		SELECT COUNT(*)
		FROM users
		WHERE gender NOT IN ('male', 'female')
	`).Scan(&unsupportedCount)
}
