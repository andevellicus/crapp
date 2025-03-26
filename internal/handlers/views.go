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

// ServeLogin serves the login.html file
func (h *GinViewHandler) ServeLogin(c *gin.Context) {
	c.File(filepath.Join(h.staticDir, "templates", "login.html"))
}

// ServeRegister serves the register.html file
func (h *GinViewHandler) ServeRegister(c *gin.Context) {
	c.File(filepath.Join(h.staticDir, "templates", "register.html"))
}

// ServeProfile serves the user profile page
func (h *GinViewHandler) ServeProfile(c *gin.Context) {
	c.File(filepath.Join(h.staticDir, "templates", "profile.html"))
}

// ServeDevices serves the user devices management page
func (h *GinViewHandler) ServeDevices(c *gin.Context) {
	c.File(filepath.Join(h.staticDir, "templates", "devices.html"))
}
