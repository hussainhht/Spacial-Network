package sqlite

import (
	"database/sql"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
)

func Open(dirPath, fileName string) (*sql.DB, error) {
	if err := os.MkdirAll(dirPath, 0o755); err != nil {
		return nil, err
	}

	dsn := filepath.Join(dirPath, fileName) + "?_foreign_keys=on"
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

	return db, nil
}
