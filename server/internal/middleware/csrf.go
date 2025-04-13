package middleware

import (
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"net/url"

	"github.com/gin-gonic/gin"
)

// GenerateCSRFToken creates a random token for CSRF protection
func GenerateCSRFToken() (string, error) {
	b := make([]byte, 32)
	_, err := rand.Read(b)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(b), nil
}

// CSRFMiddleware provides protection against Cross-Site Request Forgery
func CSRFMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip for GET, HEAD, OPTIONS requests
		if c.Request.Method == "GET" ||
			c.Request.Method == "HEAD" ||
			c.Request.Method == "OPTIONS" {
			c.Next()
			return
		}

		// Check CSRF token
		token := c.GetHeader("X-CSRF-Token")
		if token == "" {
			// Also check from form data
			token = c.PostForm("csrf_token")
		}

		// URL-decode the token from the header (or form)
		decodedToken, err := url.QueryUnescape(token)
		if err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "Invalid CSRF token format"})
			c.Abort()
			return
		}

		// Get token from cookie
		csrfCookie, err := c.Cookie("csrf_token")
		if err != nil || decodedToken != csrfCookie {
			c.JSON(http.StatusForbidden, gin.H{"error": "CSRF token validation failed"})
			c.Abort()
			return
		}

		c.Next()
	}
}

// SetCSRFTokenMiddleware sets a CSRF token in a cookie and in the response headers
func SetCSRFTokenMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Only set on GET requests
		if c.Request.Method != "GET" {
			c.Next()
			return
		}

		// Get existing token from cookie
		existingToken, err := c.Cookie("csrf_token")
		if err == nil && existingToken != "" {
			// Token exists, set it in header
			c.Header("X-CSRF-Token", existingToken)
			c.Next()
			return
		}

		// Generate new token
		token, err := GenerateCSRFToken()
		if err != nil {
			c.Next()
			return
		}

		// Set token in cookie - NOT HttpOnly so JS can access it
		c.SetCookie("csrf_token", token, 3600, "/", "", true, false)

		// Also set in header for easy access
		c.Header("X-CSRF-Token", token)

		c.Next()
	}
}
