package session

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"time"
)

func GenerateSessionToken() (string, error) {
	byteToken := make([]byte, 32)
	_, err := rand.Read(byteToken)
	if err != nil {
		return "", err
	}
	return hex.EncodeToString(byteToken), nil
}

func UpdateSessionToken(w http.ResponseWriter, duration time.Duration) error {
	token, err := GenerateSessionToken()
	if err != nil {
		return err
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    token,
		Path:     "/", // must match original Path
		Expires:  time.Now().Add(duration),
		HttpOnly: true,
		Secure:   false, // set to true in production (HTTPS)
		SameSite: http.SameSiteLaxMode,
	})
	return nil
}
