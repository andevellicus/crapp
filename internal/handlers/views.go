package handlers

import (
	"path/filepath"

	"github.com/gin-gonic/gin"
)

// GinViewHandler handles serving HTML files
type GinViewHandler struct {
	staticDir string
}

// NewGinViewHandler creates a new view handler for Gin
func NewGinViewHandler(staticDir string) *GinViewHandler {
	return &GinViewHandler{
		staticDir: staticDir,
	}
}

// ServeIndex serves the index.html file
func (h *GinViewHandler) ServeIndex(c *gin.Context) {
	c.File(filepath.Join(h.staticDir, "templates", "index.html"))
}

// ServeVisualize serves the visualization.html file
func (h *GinViewHandler) ServeVisualize(c *gin.Context) {
	c.File(filepath.Join(h.staticDir, "templates", "visualize.html"))
}
