package helpers

import (
	"os"
	"path/filepath"
)

func OpenOrCreateFile(dirPath, fileName string) (*os.File, error) {
	// Ensure the directory exists
	if err := os.MkdirAll(dirPath, 0o755); err != nil {
		return nil, err
	}

	fullPath := filepath.Join(dirPath, fileName)

	// Open or create the file
	file, err := os.OpenFile(
		fullPath,
		os.O_RDWR|os.O_CREATE,
		0o644,
	)
	if err != nil {
		return nil, err
	}

	return file, nil
}
