package handlers

import (
	"net/http"
	"path/filepath"

	"github.com/gorilla/mux"
)

// ViewHandler handles serving HTML and static files
type ViewHandler struct {
	staticDir string
}

// NewViewHandler creates a new view handler
func NewViewHandler(staticDir string) *ViewHandler {
	return &ViewHandler{
		staticDir: staticDir,
	}
}

// ServeIndex serves the index.html file
func (h *ViewHandler) ServeIndex(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, filepath.Join(h.staticDir, "templates", "index.html"))
}

// ServeVisualize serves the visualization.html file
func (h *ViewHandler) ServeVisualize(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, filepath.Join(h.staticDir, "templates", "visualize.html"))
}

// ServeStatic sets up static file serving
func (h *ViewHandler) ServeStatic(router *mux.Router) {
	fs := http.FileServer(http.Dir(h.staticDir))
	router.PathPrefix("/static/").Handler(http.StripPrefix("/static/", fs))
}
