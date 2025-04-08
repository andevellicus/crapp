package handlers

import (
	"fmt"
	"html/template"
	"net/http"
	"os"
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

// Create a new handler:
func (h *GinViewHandler) ServeReactApp(c *gin.Context) {
	c.HTML(http.StatusOK, "app.html", gin.H{
		"title": "CRAPP - Cognitive Reporting APP",
	})
}

// setupTemplates initializes templates with custom functions
func SetupTemplates() (*template.Template, error) {
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

	templatePath := filepath.Join("static", "templates")

	// Check for existence of directories:
	info, err := os.Stat(templatePath)
	if os.IsNotExist(err) {
		return nil, fmt.Errorf("directory does not exist: %s", templatePath)
	}
	if err != nil {
		return nil, fmt.Errorf("error checking directory %s: %v", templatePath, err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("expected directory but found a file: %s", templatePath)
	}

	template.Must(templates.ParseGlob(filepath.Join(templatePath, "*.html")))

	return templates, nil
}
