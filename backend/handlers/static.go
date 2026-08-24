package handlers

import "net/http"

const srcDir = "web/src"

func SrcFileServer() http.Handler {
	return http.StripPrefix("/src/", http.FileServer(http.Dir(srcDir)))
}
