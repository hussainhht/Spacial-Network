package users

import (
	"database/sql"

	"golang.org/x/crypto/bcrypt"
)

type FollowChecker interface {
	IsFollowing(followerID, followedID int) (bool, error)
}

type Service struct {
	repo          *Repository
	followChecker FollowChecker
}

func NewService(repo *Repository, followChecker FollowChecker) *Service {
	return &Service{
		repo:          repo,
		followChecker: followChecker,
	}
}

func (s *Service) UsernameExists(username string) (bool, error) {
	return s.repo.UsernameExists(username)
}

func (s *Service) EmailExists(email string) (bool, error) {
	return s.repo.EmailExists(email)
}

func (s *Service) CreateUser(uuid, username string, age int, gender, firstName, lastName, email, password, profilePhoto string) error {
	hashedPassword, err := hashPassword(password)
	if err != nil {
		return err
	}

	return s.repo.InsertUser(uuid, username, age, gender, firstName, lastName, email, hashedPassword, profilePhoto)
}

// CheckCredentials verifies a username/email and password against the stored hash.
func (s *Service) CheckCredentials(identifier, password string) (int, error) {
	id, hashedPassword, err := s.repo.GetCredentials(identifier)
	if err != nil {
		return 0, err
	}

	if !comparePasswords(hashedPassword, password) {
		return 0, ErrInvalidCredentials
	}

	return id, nil
}

func (s *Service) GetUsernameByID(userID int) (string, error) {
	return s.repo.GetUsernameByID(userID)
}

func (s *Service) GetUserIDByUsername(username string) (int, error) {
	return s.repo.GetUserIDByUsername(username)
}

// GetSummariesByIDs returns a lightweight Summary for each of ids, keyed by
// user ID.
func (s *Service) GetSummariesByIDs(ids []int) (map[int]Summary, error) {
	return s.repo.GetSummariesByIDs(ids)
}

// GetProfileByID retrieves a user's profile by their user ID.
func (s *Service) GetProfileByID(userID int) (*Profile, error) {
	return s.repo.GetProfileByID(userID)
}

// GetProfileByUsername retrieves a user's profile by their username.
func (s *Service) GetProfileByUsername(username string) (*Profile, error) {
	return s.repo.GetProfileByUsername(username)
}

func hashPassword(password string) (string, error) {
	hashed, err := bcrypt.GenerateFromPassword(
		[]byte(password),
		bcrypt.DefaultCost,
	)
	if err != nil {
		return "", err
	}
	return string(hashed), nil
}

func (s *Service) CanViewFullProfile(viewerID int, profile *Profile) (bool, error) {
	if profile == nil {
		return false, nil
	}

	if viewerID == profile.ID {
		return true, nil
	}

	if !profile.IsPrivate {
		return true, nil
	}

	if s.followChecker == nil {
		return false, nil
	}

	return s.followChecker.IsFollowing(viewerID, profile.ID)
}

func comparePasswords(hashedPassword, plainPassword string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(plainPassword)) == nil
}

func (s *Service) UpdateProfilePrivacy(userID int, isPrivate bool) error {
	return s.repo.UpdateProfilePrivacy(userID, isPrivate)
}

func (s *Service) UpdateProfileDetails(userID int, req UpdateProfileDetailsRequest) (*Profile, error) {
	return s.repo.UpdateProfileDetails(
		userID,
		req.FirstName,
		req.LastName,
		nullableProfileString(req.Nickname),
		nullableProfileString(req.AboutMe),
		nullableProfileString(req.DateOfBirth),
	)
}

func (s *Service) UpdateProfilePhoto(userID int, profilePhotoPath string) (*Profile, string, error) {
	return s.repo.UpdateProfilePhoto(userID, nullableProfileString(&profilePhotoPath))
}

func nullableProfileString(value *string) sql.NullString {
	if value == nil {
		return sql.NullString{}
	}

	return sql.NullString{
		String: *value,
		Valid:  true,
	}
}
