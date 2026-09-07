package upload

import (
	"fmt"
	"mime/multipart"
	"os"
	"path/filepath"
)

const (
	PostsSubdir    = "posts"
	CommentsSubdir = "comments"
)

// allowedMediaTypes covers the still/animated image formats accepted for
// post and comment attachments. Unlike avatars, WebP is allowed here.
var allowedMediaTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/gif":  ".gif",
	"image/webp": ".webp",
}

// MediaStorage saves optional image/GIF attachments for posts or comments,
// each feature getting its own subdirectory under the shared uploads root.
type MediaStorage struct {
	root    string
	subdir  string
	maxSize int64
}

func NewMediaStorage(uploadsRoot, subdir string, maxSize int64) (*MediaStorage, error) {
	dir := filepath.Join(uploadsRoot, subdir)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, fmt.Errorf("create %s upload dir: %w", subdir, err)
	}

	return &MediaStorage{root: uploadsRoot, subdir: subdir, maxSize: maxSize}, nil
}

func (s *MediaStorage) Save(file multipart.File, header *multipart.FileHeader) (string, error) {
	return saveUpload(s.root, s.subdir, allowedMediaTypes, s.maxSize, file, header)
}

func (s *MediaStorage) Remove(relPath string) error {
	return removeUpload(s.root, relPath)
}
