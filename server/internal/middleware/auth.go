package middleware

import (
	"net/http"
	"strings"

	"github.com/andevellicus/crapp/internal/services"
	"github.com/gin-gonic/gin"
)

// AuthMiddleware verifies the JWT token in cookies or Authorization header
func AuthMiddleware(authService *services.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var tokenString string

		// First try to get token from cookie
		token, err := c.Cookie("auth_token")
		if err == nil && token != "" {
			tokenString = token
		} else {
			// Fall back to Authorization header
			authHeader := c.GetHeader("Authorization")
			if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
				tokenString = strings.TrimPrefix(authHeader, "Bearer ")
			}
		}

		// If no token found, return unauthorized
		if tokenString == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
			c.Abort()
			return
		}

		// Validate token
		claims, err := authService.ValidateToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

		// Set user info in context
		c.Set("userEmail", claims.Email)
		c.Set("isAdmin", claims.IsAdmin)
		c.Set("tokenID", claims.TokenID)

		c.Next()
	}
}

// AuthRedirectMiddleware redirects logged out users to login page
// This is useful for index page, where we want logged out users to be redirected
func AuthRedirectMiddleware(authService *services.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check for auth token in cookie
		token, err := c.Cookie("auth_token")

		// If no token is found, redirect to login
		if err != nil || token == "" {
			c.Redirect(http.StatusFound, "/login")
			c.Abort()
			return
		}

		// Validate token
		claims, err := authService.ValidateToken(token)
		if err != nil || claims == nil {
			// Clear invalid token cookie
			c.SetCookie("auth_token", "", -1, "/", "", true, true)

			c.Redirect(http.StatusFound, "/login")
			c.Abort()
			return
		}

		// If token is valid, set user info in context
		c.Set("userEmail", claims.Email)
		c.Set("isAdmin", claims.IsAdmin)
		c.Set("tokenID", claims.TokenID) // Store token ID for revocation

		c.Next()
	}
}

// AdminMiddleware ensures the user is an admin
func AdminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check if user is admin (should be used after AuthMiddleware)
		isAdmin, exists := c.Get("isAdmin")
		if !exists || !isAdmin.(bool) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
			c.Abort()
			return
		}

		c.Next()
	}
}
