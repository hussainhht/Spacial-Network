// Package upload_test covers social/internal/upload.MediaStorage directly:
// content-sniffed file type validation (JPEG/PNG/GIF/WebP accepted, other
// types rejected) and that the returned relative path actually exists on
// disk.
package upload_test

import (
	"bytes"
	"mime/multipart"
	"os"
	"path/filepath"
	"testing"

	"social/internal/upload"
)

// asMultipartFile wraps raw bytes as a multipart.File/FileHeader pair the
// same way http.Request.FormFile would produce from an uploaded file.
func asMultipartFile(t *testing.T, data []byte, filename string) (multipart.File, *multipart.FileHeader) {
	t.Helper()

	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	part, err := w.CreateFormFile("image", filename)
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	if _, err := part.Write(data); err != nil {
		t.Fatalf("write bytes: %v", err)
	}
	if err := w.Close(); err != nil {
		t.Fatalf("close writer: %v", err)
	}

	form, err := multipart.NewReader(&buf, w.Boundary()).ReadForm(10 << 20)
	if err != nil {
		t.Fatalf("read form: %v", err)
	}
	fh := form.File["image"][0]
	f, err := fh.Open()
	if err != nil {
		t.Fatalf("open form file: %v", err)
	}
	t.Cleanup(func() { f.Close() })

	return f, fh
}

func TestMediaStorage_Save_AcceptedTypes(t *testing.T) {
	jpeg := []byte{0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 'J', 'F', 'I', 'F', 0x00, 0x01, 0x01, 0x00, 0x00, 0x01}
	png := []byte{0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D}
	gif := []byte("GIF89a\x00\x00\x00\x00\x00\x00")
	webp := append([]byte("RIFF\x00\x00\x00\x00WEBPVP8 "), make([]byte, 8)...)

	tests := []struct {
		name string
		data []byte
	}{
		{"jpeg", jpeg},
		{"png", png},
		{"gif", gif},
		{"webp", webp},
	}

	root := t.TempDir()
	storage, err := upload.NewMediaStorage(root, upload.PostsSubdir, 5<<20)
	if err != nil {
		t.Fatalf("NewMediaStorage: %v", err)
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f, fh := asMultipartFile(t, tt.data, "upload."+tt.name)
			relPath, err := storage.Save(f, fh)
			if err != nil {
				t.Fatalf("Save(%s) failed: %v", tt.name, err)
			}
			if relPath == "" {
				t.Fatalf("expected a non-empty relative path")
			}

			fullPath := filepath.Join(root, relPath)
			if _, err := os.Stat(fullPath); err != nil {
				t.Errorf("expected saved file to exist at %s: %v", fullPath, err)
			}
		})
	}
}

func TestMediaStorage_Save_RejectsDisallowedType(t *testing.T) {
	root := t.TempDir()
	storage, err := upload.NewMediaStorage(root, upload.PostsSubdir, 5<<20)
	if err != nil {
		t.Fatalf("NewMediaStorage: %v", err)
	}

	textData := []byte("this is a plain text file, not an image, no magic bytes here")
	f, fh := asMultipartFile(t, textData, "notes.txt")

	_, err = storage.Save(f, fh)
	if err != upload.ErrInvalidFileType {
		t.Fatalf("expected ErrInvalidFileType, got %v", err)
	}
}

func TestMediaStorage_Save_RejectsOversizedFile(t *testing.T) {
	root := t.TempDir()
	storage, err := upload.NewMediaStorage(root, upload.PostsSubdir, 10)
	if err != nil {
		t.Fatalf("NewMediaStorage: %v", err)
	}

	jpeg := []byte{0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 'J', 'F', 'I', 'F', 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x02, 0x03}
	f, fh := asMultipartFile(t, jpeg, "big.jpg")

	_, err = storage.Save(f, fh)
	if err != upload.ErrFileTooLarge {
		t.Fatalf("expected ErrFileTooLarge, got %v", err)
	}
}

func TestAvatarStorage_Remove_RejectsPathTraversal(t *testing.T) {
	root := t.TempDir()
	storage, err := upload.NewAvatarStorage(root, upload.AvatarSubdir, 5<<20)
	if err != nil {
		t.Fatalf("NewAvatarStorage: %v", err)
	}

	err = storage.Remove("../outside.png")
	if err != upload.ErrInvalidUploadPath {
		t.Fatalf("expected ErrInvalidUploadPath, got %v", err)
	}
}
