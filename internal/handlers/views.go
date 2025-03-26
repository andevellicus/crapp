package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// GinViewHandler handles serving HTML files
type GinViewHandler struct {
	staticDir string
}

// CreateViewHandler creates a new view handler for Gin
func CreateViewHandler(staticDir string) *GinViewHandler {
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

// ServeVisualize serves the visualization.html file
func (h *GinViewHandler) ServeVisualize(c *gin.Context) {
	c.HTML(http.StatusOK, "visualize.html", gin.H{
		"title":       "Visulization - CRAPP",
		"isAdminPage": true,
	})
}
