// Package upload handles saving user-uploaded files to disk.
package upload

import (
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
)

const (
	AvatarSubdir     = "avatars"
	GroupPhotoSubdir = "groups"
)

var (
	ErrInvalidFileType   = errors.New("unsupported image file type")
	ErrFileTooLarge      = errors.New("file exceeds the maximum allowed size")
	ErrInvalidUploadPath = errors.New("invalid upload path")
)

var allowedAvatarTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/gif":  ".gif",
}

// AvatarStorage saves validated images (user avatars, group photos, ...)
// to a subdirectory of the shared uploads root.
type AvatarStorage struct {
	root    string
	subdir  string
	maxSize int64
}

func NewAvatarStorage(uploadsRoot, subdir string, maxSize int64) (*AvatarStorage, error) {
	dir := filepath.Join(uploadsRoot, subdir)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, fmt.Errorf("create upload dir: %w", err)
	}

	return &AvatarStorage{root: uploadsRoot, subdir: subdir, maxSize: maxSize}, nil
}

func (s *AvatarStorage) Save(file multipart.File, header *multipart.FileHeader) (string, error) {
	return saveUpload(s.root, s.subdir, allowedAvatarTypes, s.maxSize, file, header)
}

func (s *AvatarStorage) Remove(relPath string) error {
	return removeUpload(s.root, relPath)
}

// saveUpload validates file against allowedTypes/maxSize by sniffing its
// content (never trusting the client-supplied filename or Content-Type),
// then writes it under root/subdir using a random, collision-proof name.
func saveUpload(root, subdir string, allowedTypes map[string]string, maxSize int64, file multipart.File, header *multipart.FileHeader) (string, error) {
	if header.Size > maxSize {
		return "", ErrFileTooLarge
	}

	sniff := make([]byte, 512)
	n, err := io.ReadFull(file, sniff)
	if err != nil && err != io.EOF && err != io.ErrUnexpectedEOF {
		return "", err
	}
	sniff = sniff[:n]

	ext, ok := allowedTypes[http.DetectContentType(sniff)]
	if !ok {
		return "", ErrInvalidFileType
	}

	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return "", err
	}

	filename := randomFilename(ext)
	relPath := path.Join(subdir, filename)
	dstPath := filepath.Join(root, relPath)

	dst, err := os.OpenFile(dstPath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o644)
	if err != nil {
		return "", err
	}
	defer dst.Close()

	// Belt-and-braces size cap in case header.Size was inaccurate.
	written, err := io.Copy(dst, io.LimitReader(file, maxSize+1))
	if err != nil {
		os.Remove(dstPath)
		return "", err
	}
	if written > maxSize {
		os.Remove(dstPath)
		return "", ErrFileTooLarge
	}

	return relPath, nil
}

func removeUpload(root, relPath string) error {
	if relPath == "" {
		return nil
	}

	cleaned := filepath.Clean(relPath)
	if filepath.IsAbs(cleaned) || cleaned == ".." || strings.HasPrefix(cleaned, ".."+string(os.PathSeparator)) {
		return ErrInvalidUploadPath
	}

	return os.Remove(filepath.Join(root, cleaned))
}

func randomFilename(ext string) string {
	return uuid.NewString() + ext
}
