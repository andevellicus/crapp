package handlers

import (
	"html/template"
	"net/http"
	"path/filepath"

	"github.com/gin-gonic/gin"
)

// GinViewHandler handles serving HTML files
type GinViewHandler struct {
	staticDir string
}

// CreateViewHandler creates a new view handler for Gin
func CreateViewHandler(router *gin.Engine, staticDir string) *GinViewHandler {
	// Create a template renderer
	templates := filepath.Join(staticDir, "templates")
	partialsDir := filepath.Join(templates, "partials", "*.html")
	pagesDir := filepath.Join(templates, "*.html")

	// Create a template set that includes all files
	tmpl := template.New("")

	// Add partials first so they're available to pages
	template.Must(tmpl.ParseGlob(partialsDir))
	template.Must(tmpl.ParseGlob(pagesDir))

	// Set the template engine
	router.SetHTMLTemplate(tmpl)

	return &GinViewHandler{staticDir: staticDir}
}

// ServeIndex serves the index.html file
func (h *GinViewHandler) ServeIndex(c *gin.Context) {
	c.HTML(http.StatusOK, "index.html", gin.H{
		"title": "CRAPP - Home",
	})
}

// ServeLogin serves the login.html file
func (h *GinViewHandler) ServeLogin(c *gin.Context) {
	c.HTML(http.StatusOK, "login.html", gin.H{
		"title": "Login - CRAPP",
	})
}

// ServeVisualize serves the visualization.html file
func (h *GinViewHandler) ServeVisualize(c *gin.Context) {
	c.HTML(http.StatusOK, "visualization.html", gin.H{
		"title": "Visulization - CRAPP",
	})
}

// ServeRegister serves the register.html file
func (h *GinViewHandler) ServeRegister(c *gin.Context) {
	c.HTML(http.StatusOK, "register.html", gin.H{
		"title": "Register - CRAPP",
	})
}

// ServeProfile serves the user profile page
func (h *GinViewHandler) ServeProfile(c *gin.Context) {
	c.HTML(http.StatusOK, "profile.html", gin.H{
		"title": "Profile - CRAPP",
	})
}

// ServeDevices serves the user devices management page
func (h *GinViewHandler) ServeDevices(c *gin.Context) {
	c.HTML(http.StatusOK, "devices.html", gin.H{
		"title": "Devices - CRAPP",
	})
}
