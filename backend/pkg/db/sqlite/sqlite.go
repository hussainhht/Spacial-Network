package sqlite

import (
	"database/sql"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
)

func Open(dirPath, fileName string) (*sql.DB, error) {
	if err := os.MkdirAll(dirPath, 0o700); err != nil {
		return nil, err
	}

	dsn := filepath.Join(dirPath, fileName) + "?_foreign_keys=on&_busy_timeout=5000"
	db, err := sql.Open("sqlite3", dsn)
	if err != nil {
		return nil, err
	}

	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)

	if err := db.Ping(); err != nil {
		db.Close()
		return nil, err
	}

	if err := os.Chmod(filepath.Join(dirPath, fileName), 0o600); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}
