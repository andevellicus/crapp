// internal/middleware/validation.go
package middleware

import (
	"net/http"
	"reflect"
	"strings"

	"github.com/andevellicus/crapp/internal/validation"
	"github.com/gin-gonic/gin"
)

// ValidateRequest validates a request against a model
func ValidateRequest(model any) gin.HandlerFunc {
	modelType := reflect.TypeOf(model)
	validator := validation.NewAPIValidator()

	return func(c *gin.Context) {
		// Create a new instance of the model
		modelValue := reflect.New(modelType).Interface()

		// Validate the request
		errors := validator.Bind(c, modelValue)
		if len(errors) > 0 {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Validation failed",
				"details": errors,
			})
			c.Abort()
			return
		}

		// Store validated model in context
		c.Set("validatedRequest", modelValue)
		c.Next()
	}
}

// ValidateJSON validates a JSON request
func ValidateJSON() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Only apply to requests that should have JSON
		if c.Request.Method == http.MethodPost || c.Request.Method == http.MethodPut || c.Request.Method == http.MethodPatch {
			contentType := c.GetHeader("Content-Type")
			if contentType != "application/json" && !strings.Contains(contentType, "application/json") {
				c.JSON(http.StatusUnsupportedMediaType, gin.H{
					"error": "Content-Type must be application/json",
				})
				c.Abort()
				return
			}
		}

		c.Next()
	}
}
