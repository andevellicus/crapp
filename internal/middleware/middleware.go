package middleware

import (
	"net/http"
	"sync"
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

func SecurityHeadersMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Other security headers remain unchanged
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")

		// More permissive CSP that still provides protection
		csp := "default-src 'self'; " +
			"script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; " +
			"style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; " +
			"img-src 'self' data:; " +
			"connect-src 'self'; " +
			"font-src 'self' https://cdnjs.cloudflare.com; " +
			"frame-ancestors 'none'; " +
			"form-action 'self'; " +
			"report-uri /csp-report"

		c.Header("Content-Security-Policy", csp)
		c.Next()
	}
}

func RateLimiterMiddleware() gin.HandlerFunc {
	// Create a store for IP-based rate limiting
	store := make(map[string][]time.Time)
	mu := &sync.Mutex{}

	return func(c *gin.Context) {
		ip := c.ClientIP()
		now := time.Now()

		mu.Lock()
		defer mu.Unlock()

		// Clean old requests (older than 1 minute)
		var recent []time.Time
		for _, t := range store[ip] {
			if now.Sub(t) < time.Minute {
				recent = append(recent, t)
			}
		}

		// Allow max 60 requests per minute
		if len(recent) >= 60 {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "Rate limit exceeded. Try again later.",
			})
			return
		}

		// Add current request time
		store[ip] = append(recent, now)

		c.Next()
	}
}
