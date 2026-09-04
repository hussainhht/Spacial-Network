# Database Migration System Documentation

---

## 1. Overview & Purpose

The database migration system provides **version-controlled, reproducible, and automated schema management** for SQLite in the Social Network project.

### Why Migrations Matter:
1. **Consistency Across Environments:** Ensures that every developer's local machine, Docker container, and production environment run the exact same database schema.
2. **Safe Schema Evolution:** Allows modifying tables (adding columns, indexes, new tables) incrementally without destroying existing user data.
3. **Rollback Capability:** Every schema change (`up`) has a corresponding rollback (`down`) in case a feature needs to be reverted.
4. **Embedded Execution (`//go:embed`):** SQL files are compiled directly into the Go binary. You do not need to manage relative file paths when deploying with Docker.

---

## 2. Architecture & Internal Mechanism

```
                   ┌──────────────────────────────────────┐
                   │   backend/cmd/migrate/main.go (CLI)   │
                   └──────────────────┬───────────────────┘
                                      │
                                      ▼
                   ┌──────────────────────────────────────┐
                   │    backend/pkg/db/sqlite/            │
                   │    ├── migrations.go (Runner)        │
                   │    ├── migration_files.go (Loader)   │
                   │    └── migration_runner.go (DB Ops)  │
                   └──────────────────┬───────────────────┘
                                      │
                         //go:embed   │
                                      ▼
                   ┌──────────────────────────────────────┐
                   │   backend/pkg/db/migrations/sqlite/  │
                   │   ├── <TIMESTAMP>_<name>.up.sql      │
                   │   └── <TIMESTAMP>_<name>.down.sql    │
                   └──────────────────┬───────────────────┘
                                      │
                                      ▼
                   ┌──────────────────────────────────────┐
                   │          SQLite Database             │
                   │      (table: schema_migrations)      │
                   └──────────────────────────────────────┘
```

### The `schema_migrations` Table
The system automatically creates a tracking table in SQLite:

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
    version    INTEGER PRIMARY KEY,
    name       TEXT NOT NULL,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

* **`version`:** The 14-digit UTC timestamp (`YYYYMMDDHHMMSS`) of the migration.
* **`name`:** The descriptive name of the migration (e.g., `create_users_table`).
* **`applied_at`:** Timestamp when the migration was executed.

### Transactional Safety
Every individual migration is wrapped in an atomic SQL transaction:
```go
tx, err := db.Begin()
// Execute .up.sql or .down.sql
// Record or delete version in schema_migrations
tx.Commit() // or tx.Rollback() if an error occurs
```
If any SQL query fails, the entire transaction is rolled back, preventing the database from becoming partially updated or corrupted.

---

## 3. Versioning Strategy: UTC Timestamps

The system uses **14-digit UTC Timestamps** (`YYYYMMDDHHMMSS`) instead of sequential integers (`000001`, `000002`).

### Format:
```
YYYY MM DD HH MM SS _ <migration_name> . <up|down> . sql
2026 08 28 01 20 00 _ create_messages_table . up . sql
```

### Why this solves team collisions:
When multiple developers work on separate branches simultaneously:
- **Sequential numbers collide:** Dev A creates `000004_posts` and Dev B creates `000004_chat`. When merged, the versions overlap and crash.
- **Timestamps never collide:** Dev A creates `20260828012000_posts` and Dev B creates `20260828012015_chat`. Both merge cleanly into `main`, and SQLite applies them in chronological order without renaming.

---

## 4. CLI Commands Reference

All migration commands are run from the `backend/` directory:

### 1. `create <name>` (Generate New Migration)
Generates a new pair of timestamped `.up.sql` and `.down.sql` template files in `backend/pkg/db/migrations/sqlite/`.

```bash
go run ./cmd/migrate create create_private_messages_table
```

**Output:**
```text
Created migration:
  pkg/db/migrations/sqlite/20260828012000_create_private_messages_table.up.sql
  pkg/db/migrations/sqlite/20260828012000_create_private_messages_table.down.sql
```

---

### 2. `up` (Apply All Pending Migrations)
Scans all embedded migration files, checks which ones are not yet recorded in `schema_migrations`, and applies them in chronological order.

```bash
go run ./cmd/migrate up
```

*(Note: The main backend server `cmd/server/main.go` also automatically calls `sqlite.MigrateUp(db)` on startup).*

---

### 3. `down` (Roll Back Latest Migration)
Reverts **only the single most recently applied migration** by executing its corresponding `.down.sql` file and removing its entry from `schema_migrations`.

```bash
go run ./cmd/migrate down
```

---

### 4. `down-all` (Reset Database Schema)
Repeatedly rolls back every applied migration one-by-one until the database schema is completely empty.

```bash
go run ./cmd/migrate down-all
```

---

### 5. `version` (Check Current Version)
Prints the timestamp version of the latest applied migration currently recorded in SQLite.

```bash
go run ./cmd/migrate version
```

**Output:**
```text
Migration version: 20260827221115
```
*(Outputs `0` if no migrations have been applied yet).*

---

## 5. How to Write Migration Files

### 1. The `.up.sql` File
Contains the forward schema changes (e.g. creating tables, adding columns, adding indexes).

* Always start with `PRAGMA foreign_keys = ON;` to ensure SQLite enforces relational integrity.
* Use `CREATE TABLE IF NOT EXISTS` or `CREATE INDEX IF NOT EXISTS`.

**Example:**
```sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS private_messages (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id    INTEGER NOT NULL,
    recipient_id INTEGER NOT NULL,
    content      TEXT NOT NULL,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at      DATETIME,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_private_messages_pair 
ON private_messages(sender_id, recipient_id, created_at);
```

---

### 2. The `.down.sql` File
Contains the exact inverse operations to completely undo the `.up.sql` file.

* Drop indexes before dropping tables.
* Use `DROP TABLE IF EXISTS` and `DROP INDEX IF EXISTS`.

**Example:**
```sql
DROP INDEX IF EXISTS idx_private_messages_pair;
DROP TABLE IF EXISTS private_messages;
```

---

## 6. Developer Workflow Checklist

When building a new feature (e.g. Chat, Posts, Groups):

1. **Create migration files:**
   ```bash
   cd backend
   go run ./cmd/migrate create create_your_feature_table
   ```
2. **Write SQL in `.up.sql` and `.down.sql`.**
3. **Test applying the migration:**
   ```bash
   go run ./cmd/migrate up
   go run ./cmd/migrate version
   ```
4. **Test rolling back the migration:**
   ```bash
   go run ./cmd/migrate down
   go run ./cmd/migrate version
   ```
5. **Re-apply and commit:**
   ```bash
   go run ./cmd/migrate up
   git add pkg/db/migrations/sqlite/
   git commit -m "feat: add migration for your_feature table"
   ```
