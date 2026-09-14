package users

import "mime/multipart"

type AvatarStorage interface {
	Save(file multipart.File, header *multipart.FileHeader) (string, error)
	Remove(relPath string) error
}
