PRAGMA foreign_keys = ON;

-- -----------------------------
-- USERS
-- -----------------------------
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid          TEXT    NOT NULL UNIQUE,              -- external/public id
    username      TEXT    NOT NULL UNIQUE,
    age           INTEGER NOT NULL CHECK (age >= 0 AND age <= 120),
    gender        TEXT    NOT NULL CHECK (gender IN ('male','female')),
    first_name    TEXT    NOT NULL,
    last_name     TEXT    NOT NULL,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------
-- SESSIONS (source of truth for login)
-- -----------------------------
CREATE TABLE IF NOT EXISTS sessions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL,
    session_token TEXT    NOT NULL UNIQUE,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at    DATETIME NOT NULL,
    revoked_at    DATETIME,                              -- null = active

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- CREATE INDEX IF NOT EXISTS idx_sessions_user_expires
-- ON sessions(user_id, expires_at);

-- CREATE INDEX IF NOT EXISTS idx_sessions_expires
-- ON sessions(expires_at);

-- CREATE INDEX IF NOT EXISTS idx_sessions_token_active
-- ON sessions(session_token, revoked_at, expires_at);

-- -- NOTE: "logged in" query becomes:
-- -- EXISTS(SELECT 1 FROM sessions WHERE user_id=? AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP)


-- -- -----------------------------
-- -- ONLINE PRESENCE (optional, NOT auth)
-- -- -----------------------------
-- CREATE TABLE IF NOT EXISTS user_presence (
--     user_id     INTEGER PRIMARY KEY,
--     is_online   INTEGER NOT NULL DEFAULT 0 CHECK (is_online IN (0,1)),
--     last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
--     updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

--     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
-- );

-- CREATE TRIGGER IF NOT EXISTS user_presence_set_updated_at
-- AFTER UPDATE ON user_presence
-- FOR EACH ROW
-- BEGIN
--   UPDATE user_presence SET updated_at = CURRENT_TIMESTAMP WHERE user_id = NEW.user_id;
-- END;

