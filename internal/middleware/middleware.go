package middleware

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// GinLogger returns a Gin middleware for Zap logging
func GinLogger(log *zap.SugaredLogger) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Start timer
		start := time.Now()
		path := c.Request.URL.Path
		raw := c.Request.URL.RawQuery

		// Process request
		c.Next()

		// Calculate latency
		latency := time.Since(start)

		// Get status code and client IP
		statusCode := c.Writer.Status()
		clientIP := c.ClientIP()
		method := c.Request.Method
		errorMessage := c.Errors.String()

		if raw != "" {
			path = path + "?" + raw
		}

		// Log based on status code
		switch {
		case statusCode >= 500:
			log.Errorw("Server error",
				"status", statusCode,
				"latency", latency,
				"client", clientIP,
				"method", method,
				"path", path,
				"error", errorMessage,
			)
		case statusCode >= 400:
			log.Warnw("Client error",
				"status", statusCode,
				"latency", latency,
				"client", clientIP,
				"method", method,
				"path", path,
			)
		default:
			log.Infow("Request completed",
				"status", statusCode,
				"latency", latency,
				"client", clientIP,
				"method", method,
				"path", path,
			)
		}
	}
}

// GinAuth returns a Gin middleware for basic authentication
// This is a placeholder for future auth implementation
func GinAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip authentication for public paths
		publicPaths := map[string]bool{
			"/":          true,
			"/visualize": true,
			"/static/":   true,
		}

		path := c.Request.URL.Path

		// Check if path is public
		for publicPath := range publicPaths {
			if len(publicPath) <= len(path) && path[:len(publicPath)] == publicPath {
				c.Next()
				return
			}
		}

		// For API routes, check for user_id parameter
		// This is very basic and should be replaced with proper auth
		userID := c.Query("user_id")
		if userID == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		// Set user ID in context for later use
		c.Set("user_id", userID)

		c.Next()
	}
}
