package middleware

import (
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
