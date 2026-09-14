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
