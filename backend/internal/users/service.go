package users

import (
	"golang.org/x/crypto/bcrypt"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{
		repo: repo,
	}
}

func (s *Service) UsernameExists(username string) (bool, error) {
	return s.repo.UsernameExists(username)
}

func (s *Service) EmailExists(email string) (bool, error) {
	return s.repo.EmailExists(email)
}

func (s *Service) CreateUser(uuid, username string, age int, gender, firstName, lastName, email, password, profilePhoto, aboutMe, nickname string) error {
	hashedPassword, err := hashPassword(password)
	if err != nil {
		return err
	}

	return s.repo.InsertUser(uuid, username, age, gender, firstName, lastName, email, hashedPassword, profilePhoto, aboutMe, nickname)
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

func comparePasswords(hashedPassword, plainPassword string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(plainPassword)) == nil
}

func (s *Service) UpdateProfilePrivacy(userID int, isPrivate bool) error {
	return s.repo.UpdateProfilePrivacy(userID, isPrivate)
}
