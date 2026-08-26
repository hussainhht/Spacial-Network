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

func UpdateSessionToken(w http.ResponseWriter, cookieName string, duration time.Duration, secure bool) error {
	token, err := GenerateSessionToken()
	if err != nil {
		return err
	}

	http.SetCookie(w, &http.Cookie{
		Name:     cookieName,
		Value:    token,
		Path:     "/", // must match original Path
		Expires:  time.Now().Add(duration),
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
	})
	return nil
}
