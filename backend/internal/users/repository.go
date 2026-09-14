package users

import (
	"database/sql"
	"strings"
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

// GetSummariesByIDs returns a lightweight Summary for each of ids, keyed by
// user ID. IDs that don't exist are simply absent from the result.
func (r *Repository) GetSummariesByIDs(ids []int) (map[int]Summary, error) {
	summaries := make(map[int]Summary, len(ids))
	if len(ids) == 0 {
		return summaries, nil
	}

	placeholders := make([]string, len(ids))
	args := make([]any, len(ids))
	for i, id := range ids {
		placeholders[i] = "?"
		args[i] = id
	}

	rows, err := r.db.Query(`
		SELECT id, username, first_name, last_name, COALESCE(profile_photo, '')
		FROM users
		WHERE id IN (`+strings.Join(placeholders, ",")+`)
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var s Summary
		var profilePhoto string
		if err := rows.Scan(&s.ID, &s.Username, &s.FirstName, &s.LastName, &profilePhoto); err != nil {
			return nil, err
		}
		if profilePhoto != "" {
			s.ProfilePhoto = "/uploads/" + profilePhoto
		}
		summaries[s.ID] = s
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return summaries, nil
}

// GetProfileByID returns profile data for a user ID.
func (r *Repository) GetProfileByID(userID int) (*Profile, error) {
	profile := &Profile{}

	err := r.db.QueryRow(`
		SELECT id, uuid, username, age, gender, first_name, last_name, email, profile_photo, created_at, updated_at, is_private, nickname, about_me, date_of_birth
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
		&profile.Nickname,
		&profile.AboutMe,
		&profile.DateOfBirth,
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
		SELECT id, uuid, username, age, gender, first_name, last_name, email, profile_photo, created_at, updated_at, is_private, nickname, about_me, date_of_birth
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
		&profile.Nickname,
		&profile.AboutMe,
		&profile.DateOfBirth,
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

func (r *Repository) UpdateProfileDetails(
	userID int,
	firstName string,
	lastName string,
	nickname sql.NullString,
	aboutMe sql.NullString,
	dateOfBirth sql.NullString,
) (*Profile, error) {
	result, err := r.db.Exec(`
		UPDATE users
		SET first_name = ?, last_name = ?, nickname = ?, about_me = ?, date_of_birth = ?, updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`, firstName, lastName, nickname, aboutMe, dateOfBirth, userID)
	if err != nil {
		return nil, err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return nil, err
	}

	if rowsAffected == 0 {
		return nil, sql.ErrNoRows
	}

	return r.GetProfileByID(userID)
}

func (r *Repository) UpdateProfilePhoto(
	userID int,
	profilePhoto sql.NullString,
) (*Profile, string, error) {
	current, err := r.GetProfileByID(userID)
	if err != nil {
		return nil, "", err
	}

	oldPhoto := ""
	if current.ProfilePhoto.Valid {
		oldPhoto = current.ProfilePhoto.String
	}

	nextPhoto := ""
	if profilePhoto.Valid {
		nextPhoto = profilePhoto.String
	}

	result, err := r.db.Exec(`
		UPDATE users
		SET profile_photo = NULLIF(?, ''), updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`, nextPhoto, userID)
	if err != nil {
		return nil, "", err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return nil, "", err
	}

	if rowsAffected == 0 {
		return nil, "", sql.ErrNoRows
	}

	updated, err := r.GetProfileByID(userID)
	if err != nil {
		return nil, "", err
	}

	return updated, oldPhoto, nil
}
