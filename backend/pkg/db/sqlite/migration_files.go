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
	version    int64
	rawVersion string
	name       string
}

func (m migration) upFile() string {
	return fmt.Sprintf("%s_%s.up.sql", m.rawVersion, m.name)
}

func (m migration) downFile() string {
	return fmt.Sprintf("%s_%s.down.sql", m.rawVersion, m.name)
}

func loadMigrations() ([]migration, error) {
	entries, err := migrationFiles.ReadDir(".")
	if err != nil {
		return nil, err
	}

	var migrations []migration
	seen := make(map[int64]string)

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		matches := migrationFilePattern.FindStringSubmatch(entry.Name())
		if matches == nil {
			continue
		}

		version, err := strconv.ParseInt(matches[1], 10, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid migration version in %s: %w", entry.Name(), err)
		}

		if existing, ok := seen[version]; ok {
			return nil, fmt.Errorf("duplicate migration version %d: %s and %s", version, existing, entry.Name())
		}
		seen[version] = entry.Name()

		migrations = append(migrations, migration{
			version:    version,
			rawVersion: matches[1],
			name:       matches[2],
		})
	}

	sort.Slice(migrations, func(i, j int) bool {
		return migrations[i].version < migrations[j].version
	})

	return migrations, nil
}
