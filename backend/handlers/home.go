package handlers

import (
	"net/http"
)

const indexPath = "web/public/index.html"

func HandleHome(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	http.ServeFile(w, r, indexPath)
}
