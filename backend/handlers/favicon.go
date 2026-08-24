package handlers

import "net/http"

const faviconPath = "web/src/static/icons/favicon.ico"

func Favicon(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, faviconPath)
}

func GeneralIconHandler(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, "web/src/static/icons/general.png")
}
