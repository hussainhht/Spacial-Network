package db

import (
	"database/sql"
	"os"

	_ "github.com/mattn/go-sqlite3"
)

var (
	Db  *sql.DB
	err error
)

func InitDB(file *os.File) (*sql.DB, error) {
	dbPath := file.Name()

	Db, err = sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, err
	}

	if err := Db.Ping(); err != nil {
		return nil, err
	}

	Db.SetMaxOpenConns(1)
	Db.SetMaxIdleConns(1)

	return Db, nil
}

func InitSchema(Db *sql.DB) error {
	schema, err := os.ReadFile("db/schema.sql")
	if err != nil {
		return err
	}

	if _, err = Db.Exec(string(schema)); err != nil {
		return err
	}

	return enforceBinaryGenderValues(Db)
}

func enforceBinaryGenderValues(db *sql.DB) error {
	var unsupportedCount int
	if err := db.QueryRow(`
		SELECT COUNT(*)
		FROM users
		WHERE gender NOT IN ('male', 'female')
	`).Scan(&unsupportedCount); err != nil {
		return err
	}

	return nil
}
