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

// NewViewHandler creates a new view handler for Gin
func NewViewHandler(staticDir string) *GinViewHandler {
	return &GinViewHandler{
		staticDir: staticDir,
	}
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
		"title":       "Login - CRAPP",
		"includeAuth": true,
	})
}

// ServeRegister serves the register.html file
func (h *GinViewHandler) ServeRegister(c *gin.Context) {
	c.HTML(http.StatusOK, "register.html", gin.H{
		"title":       "Register - CRAPP",
		"includeAuth": true,
	})
}

// ServeProfile serves the user profile page
func (h *GinViewHandler) ServeProfile(c *gin.Context) {
	c.HTML(http.StatusOK, "profile.html", gin.H{
		"title":          "Profile - CRAPP",
		"includeAuth":    true,
		"includeProfile": true,
		"includePush":    true,
	})
}

// ServeDevices serves the user devices management page
func (h *GinViewHandler) ServeDevices(c *gin.Context) {
	c.HTML(http.StatusOK, "devices.html", gin.H{
		"title":          "Devices - CRAPP",
		"includeAuth":    true,
		"includeProfile": true,
	})
}

// ServeAdminUsers serves the admin users page
func (h *GinViewHandler) ServeAdminUsers(c *gin.Context) {
	c.HTML(http.StatusOK, "admin_users.html", gin.H{
		"title":       "Manage Users - CRAPP Admin",
		"isAdminPage": true,
	})
}

// ServeVisualize serves the visualization.html file
func (h *GinViewHandler) ServeVisualize(c *gin.Context) {
	c.HTML(http.StatusOK, "visualize.html", gin.H{
		"title":       "Visulization - CRAPP",
		"isAdminPage": true,
		"includeViz":  true,
	})
}

// setupTemplates initializes templates with custom functions
func SetupTemplates() *template.Template {
	// Define custom template functions
	funcMap := template.FuncMap{
		"add": func(a, b int) int {
			return a + b
		},
		"sub": func(a, b int) int {
			return a - b
		},
		// Add more custom functions as needed
	}

	// Create template with functions
	templates := template.New("").Funcs(funcMap)

	// Parse template files
	partialsDir := filepath.Join("static", "templates", "partials", "*.html")
	pagesDir := filepath.Join("static", "templates", "*.html")

	// Add partials first so they're available to pages
	template.Must(templates.ParseGlob(partialsDir))
	template.Must(templates.ParseGlob(pagesDir))

	return templates
}
