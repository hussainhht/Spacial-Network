package config

import (
	"testing"
)

func TestLoadConfigDefaults(t *testing.T) {
	cfg := Load()

	if cfg.DBDir != "data" {
		t.Errorf("expected DBDir 'data', got %q", cfg.DBDir)
	}

	if cfg.DBFile != "social-network.db" {
		t.Errorf("expected DBFile 'social-network.db', got %q", cfg.DBFile)
	}

	if cfg.UploadsDir != "data/uploads" {
		t.Errorf("expected UploadsDir 'data/uploads', got %q", cfg.UploadsDir)
	}

	if cfg.ServerPort != "8080" {
		t.Errorf("expected ServerPort '8080', got %q", cfg.ServerPort)
	}
}

func TestLoadConfigEnvOverrides(t *testing.T) {
	t.Setenv("SERVER_PORT", "9090")

	cfg := Load()

	if cfg.ServerPort != "9090" {
		t.Errorf("expected ServerPort '9090', got %q", cfg.ServerPort)
	}
}

func TestProductionConfig(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("TRUSTED_ORIGINS", "https://social.example.com")
	t.Setenv("DB_DIR", "/tmp/custom-db")
	t.Setenv("UPLOADS_DIR", "/tmp/custom-uploads")
	cfg := Load()
	if !cfg.CookieSecure || cfg.DBDir != "/tmp/custom-db" || cfg.UploadsDir != "/tmp/custom-uploads" {
		t.Fatal("environment not applied")
	}
	if err := cfg.Validate(); err != nil {
		t.Fatal(err)
	}
	for _, origin := range []string{"http://social.example.com", "https://localhost", "*", "https://social.example.com/", "https://social.example.com@evil.example.com/path"} {
		cfg.TrustedOrigins = []string{origin}
		if cfg.Validate() == nil {
			t.Errorf("accepted unsafe origin %s", origin)
		}
	}
}
