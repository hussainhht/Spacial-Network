package users

import (
	"database/sql"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{
		db: db,
	}
}

func (r *Repository) UsernameExists(username string) (bool, error) {
	var exists int

	err := r.db.QueryRow(
		`SELECT 1 FROM users WHERE username = ? LIMIT 1`,
		username,
	).Scan(&exists)

	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}

	return true, nil
}

// EmailExists checks if an email already exists
func (r *Repository) EmailExists(email string) (bool, error) {
	var exists int
	err := r.db.QueryRow(
		`SELECT 1 FROM users WHERE email = ? LIMIT 1`,
		email,
	).Scan(&exists)
	if err == sql.ErrNoRows {
		return false, nil
	}
	return err == nil, err
}

func (r *Repository) InsertUser(uuid, username string, age int, gender, firstName, lastName, email, passwordHash, profilePhoto string) error {
	query := `
		INSERT INTO users (uuid, username, age, gender, first_name, last_name, email, password_hash, profile_photo)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	var photo sql.NullString
	if profilePhoto != "" {
		photo = sql.NullString{String: profilePhoto, Valid: true}
	}
	_, err := r.db.Exec(
		query,
		uuid,
		username,
		age,
		gender,
		firstName,
		lastName,
		email,
		passwordHash,
		photo,
	)
	return err
}

// GetCredentials retrieves the user id and stored password hash for a username or email.
func (r *Repository) GetCredentials(identifier string) (int, string, error) {
	var id int
	var hashedPassword string

	err := r.db.QueryRow(`
		SELECT id, password_hash
		FROM users
		WHERE username = ? OR email = ?`,
		identifier,
		identifier,
	).Scan(&id, &hashedPassword)
	if err != nil {
		if err == sql.ErrNoRows {
			return 0, "", ErrInvalidCredentials
		}
		return 0, "", err
	}

	return id, hashedPassword, nil
}

func (r *Repository) GetUsernameByID(userID int) (string, error) {
	var username string

	err := r.db.QueryRow(`
		SELECT username
		FROM users
		WHERE id = ?
	`, userID).Scan(&username)
	if err != nil {
		return "", err
	}

	return username, nil
}

func (r *Repository) GetUserIDByUsername(username string) (int, error) {
	var userID int

	err := r.db.QueryRow(`
		SELECT id
		FROM users
		WHERE username = ?
	`, username).Scan(&userID)
	if err != nil {
		return 0, err
	}

	return userID, nil
}

// GetProfileByID returns profile data for a user ID.
func (r *Repository) GetProfileByID(userID int) (*Profile, error) {
	profile := &Profile{}

	err := r.db.QueryRow(`
		SELECT id, uuid, username, age, gender, first_name, last_name, email, profile_photo, created_at, updated_at, is_private
		FROM users
		WHERE id = ?
	`, userID).Scan(
		&profile.ID,
		&profile.UUID,
		&profile.Username,
		&profile.Age,
		&profile.Gender,
		&profile.FirstName,
		&profile.LastName,
		&profile.Email,
		&profile.ProfilePhoto,
		&profile.CreatedAt,
		&profile.UpdatedAt,
		&profile.IsPrivate,
	)

	if err != nil {
		return nil, err
	}

	return profile, nil
}

// GetProfileByUsername returns profile data for a username.
func (r *Repository) GetProfileByUsername(username string) (*Profile, error) {
	profile := &Profile{}

	err := r.db.QueryRow(`
		SELECT id, uuid, username, age, gender, first_name, last_name, email, profile_photo, created_at, updated_at, is_private
		FROM users
		WHERE username = ?
	`, username).Scan(
		&profile.ID,
		&profile.UUID,
		&profile.Username,
		&profile.Age,
		&profile.Gender,
		&profile.FirstName,
		&profile.LastName,
		&profile.Email,
		&profile.ProfilePhoto,
		&profile.CreatedAt,
		&profile.UpdatedAt,
		&profile.IsPrivate,
	)

	if err != nil {
		return nil, err
	}

	return profile, nil
}

// UpdateProfilePrivacy updates the privacy setting of a user's profile.
func (r *Repository) UpdateProfilePrivacy(userID int, isPrivate bool) error {
	privacyValue := 0
	if isPrivate {
		privacyValue = 1
	}

	result, err := r.db.Exec(`
		UPDATE users
		SET is_private = ?, updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`, privacyValue, userID)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return sql.ErrNoRows
	}

	return nil
}
