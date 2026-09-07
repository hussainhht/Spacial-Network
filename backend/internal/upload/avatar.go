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

	"github.com/google/uuid"
)

const (
	AvatarSubdir     = "avatars"
	GroupPhotoSubdir = "groups"
)

var (
	ErrInvalidFileType = errors.New("file must be a JPEG, PNG, or GIF image")
	ErrFileTooLarge    = errors.New("file exceeds the maximum allowed size")
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
	if header.Size > s.maxSize {
		return "", ErrFileTooLarge
	}

	sniff := make([]byte, 512)
	n, err := io.ReadFull(file, sniff)
	if err != nil && err != io.EOF && err != io.ErrUnexpectedEOF {
		return "", err
	}
	sniff = sniff[:n]

	ext, ok := allowedAvatarTypes[http.DetectContentType(sniff)]
	if !ok {
		return "", ErrInvalidFileType
	}

	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return "", err
	}

	filename := randomFilename(ext)
	relPath := path.Join(s.subdir, filename)
	dstPath := filepath.Join(s.root, relPath)

	dst, err := os.OpenFile(dstPath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o644)
	if err != nil {
		return "", err
	}
	defer dst.Close()

	// Belt-and-braces size cap in case header.Size was inaccurate.
	written, err := io.Copy(dst, io.LimitReader(file, s.maxSize+1))
	if err != nil {
		os.Remove(dstPath)
		return "", err
	}
	if written > s.maxSize {
		os.Remove(dstPath)
		return "", ErrFileTooLarge
	}

	return relPath, nil
}


func (s *AvatarStorage) Remove(relPath string) error {
	if relPath == "" {
		return nil
	}
	return os.Remove(filepath.Join(s.root, relPath))
}

func randomFilename(ext string) string {
	return uuid.NewString() + ext
}
