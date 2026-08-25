package users

import (
	"social/pkg/errs"

	"golang.org/x/crypto/bcrypt"
)

func CreateUser(uuid, username string, age int, gender, firstName, lastName, email, password string) error {
	hashedPassword, err := hashPassword(password)
	if err != nil {
		return err
	}

	return InsertUser(uuid, username, age, gender, firstName, lastName, email, hashedPassword)
}

// CheckCredentials verifies a username/email and password against the stored hash.
func CheckCredentials(identifier, password string) (int, error) {
	id, hashedPassword, err := GetCredentials(identifier)
	if err != nil {
		return 0, err
	}

	if !comparePasswords(hashedPassword, password) {
		return 0, errs.ErrInvalidCredentials
	}

	return id, nil
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
