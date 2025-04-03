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
		"title":         "CRAPP - Home",
		"usePostMethod": false,
	})
}

// ServeLogin serves the login.html file
func (h *GinViewHandler) ServeLogin(c *gin.Context) {
	c.HTML(http.StatusOK, "login.html", gin.H{
		"title": "Login - CRAPP",
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

// ServeAdminUsers serves the admin users page
func (h *GinViewHandler) ServeAdminUsers(c *gin.Context) {
	c.HTML(http.StatusOK, "admin_users.html", gin.H{
		"title":       "Manage Users - CRAPP Admin",
		"isAdminPage": true,
	})
}

// ServeCharts serves the charts.html file
func (h *GinViewHandler) ServeCharts(c *gin.Context) {
	c.HTML(http.StatusOK, "charts.html", gin.H{
		"title":       "Charts - CRAPP",
		"isAdminPage": true,
	})
}

// ServeForgotPassword serves the forgot password page
func (h *GinViewHandler) ServeForgotPassword(c *gin.Context) {
	c.HTML(http.StatusOK, "forgot_password.html", gin.H{
		"title": "Forgot Password - CRAPP",
	})
}

// ServeResetPassword serves the reset password page
func (h *GinViewHandler) ServeResetPassword(c *gin.Context) {
	c.HTML(http.StatusOK, "reset_password.html", gin.H{
		"title": "Reset Password - CRAPP",
	})
}

// ServeCognitiveTests serves the cognitive tests page
func (h *GinViewHandler) ServeCognitiveTests(c *gin.Context) {
	c.HTML(http.StatusOK, "cpt.html", gin.H{
		"title": "Cognitive Tests - CRAPP",
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
