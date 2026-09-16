package auth

import (
	"errors"

	"social/internal/users"
	"social/pkg/session"
)

type Service struct {
	repo         *Repository
	usersService *users.Service
}

func NewService(repo *Repository, usersService *users.Service) *Service {
	return &Service{
		repo:         repo,
		usersService: usersService,
	}
}

// Login verifies credentials and issues a new session token for the user.
func (s *Service) Login(identifier, password string) (int, string, error) {
	userID, err := s.usersService.CheckCredentials(identifier, password)
	if err != nil {
		if errors.Is(err, users.ErrInvalidCredentials) {
			return 0, "", ErrInvalidCredentials
		}
		return 0, "", err
	}

	token, err := session.GenerateSessionToken()
	if err != nil {
		return 0, "", err
	}

	if err := s.repo.CreateSession(userID, token); err != nil {
		return 0, "", err
	}

	return userID, token, nil
}

func (s *Service) ChangePassword(userID int, currentPassword, newPassword string) error {
	err := s.usersService.ChangePassword(userID, currentPassword, newPassword)
	if errors.Is(err, users.ErrInvalidCredentials) {
		return ErrInvalidCredentials
	}
	return err
}

// Logout revokes the given session token.
func (s *Service) Logout(token string) error {
	return s.repo.RevokeSession(token)
}

// ValidateSession checks if session is valid and returns userID.
func (s *Service) ValidateSession(token string) (int, error) {
	return s.repo.ValidateSession(token)
}

// UpdateSessionExpiry extends the expiry of a still-valid session.
func (s *Service) UpdateSessionExpiry(token string) error {
	return s.repo.UpdateSessionExpiry(token)
}

// CleanupSessions deletes expired sessions and old revoked sessions.
func (s *Service) CleanupSessions() (int64, error) {
	return s.repo.CleanupSessions()
}
