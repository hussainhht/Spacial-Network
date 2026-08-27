package sqlite

import (
	"fmt"
	"regexp"
	"sort"
	"strconv"

	migrationfiles "social/pkg/db/migrations/sqlite"
)

var migrationFiles = migrationfiles.Files

var migrationFilePattern = regexp.MustCompile(`^(\d+)_(.+)\.up\.sql$`)

type migration struct {
	version int
	name    string
}

func (m migration) upFile() string {
	return fmt.Sprintf("%06d_%s.up.sql", m.version, m.name)
}

func (m migration) downFile() string {
	return fmt.Sprintf("%06d_%s.down.sql", m.version, m.name)
}

func loadMigrations() ([]migration, error) {
	entries, err := migrationFiles.ReadDir(".")
	if err != nil {
		return nil, err
	}

	var migrations []migration
	seen := make(map[int]string)

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		matches := migrationFilePattern.FindStringSubmatch(entry.Name())
		if matches == nil {
			continue
		}

		version, err := strconv.Atoi(matches[1])
		if err != nil {
			return nil, fmt.Errorf("invalid migration version in %s: %w", entry.Name(), err)
		}

		if existing, ok := seen[version]; ok {
			return nil, fmt.Errorf("duplicate migration version %d: %s and %s", version, existing, entry.Name())
		}
		seen[version] = entry.Name()

		migrations = append(migrations, migration{version: version, name: matches[2]})
	}

	sort.Slice(migrations, func(i, j int) bool {
		return migrations[i].version < migrations[j].version
	})

	return migrations, nil
}
