// internal/validation/api_validation.go
package validation

import (
	"fmt"
	"reflect"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
)

// APIValidator handles API request validation
type APIValidator struct {
	validator *validator.Validate
}

// NewAPIValidator creates a new API validator
func NewAPIValidator() *APIValidator {
	v := validator.New()

	v.RegisterValidation("datetime", validateDateTime)

	// Register tag name function to use json tag names in errors
	v.RegisterTagNameFunc(func(fld reflect.StructField) string {
		name := strings.SplitN(fld.Tag.Get("json"), ",", 2)[0]
		if name == "-" {
			return ""
		}
		return name
	})

	return &APIValidator{
		validator: v,
	}
}

// ValidateStruct validates a struct using validator tags
func (v *APIValidator) ValidateStruct(obj any) []ValidationError {
	err := v.validator.Struct(obj)
	if err == nil {
		return nil
	}

	var errors []ValidationError

	// Process validation errors
	for _, err := range err.(validator.ValidationErrors) {
		field := err.Field()
		tag := err.Tag()

		// Create error message based on validation tag
		var message string
		switch tag {
		case "required":
			message = fmt.Sprintf("Field '%s' is required", field)
		case "email":
			message = fmt.Sprintf("Field '%s' must be a valid email address", field)
		case "min":
			message = fmt.Sprintf("Field '%s' must be at least %s characters long", field, err.Param())
		case "max":
			message = fmt.Sprintf("Field '%s' must be at most %s characters long", field, err.Param())
		case "phone":
			message = fmt.Sprintf("Field '%s' must be a valid phone number", field)
		default:
			message = fmt.Sprintf("Validation failed for field '%s' on tag '%s'", field, tag)
		}

		errors = append(errors, ValidationError{
			Field:   field,
			Message: message,
			Tag:     tag,
			Value:   fmt.Sprintf("%v", err.Value()),
		})
	}

	return errors
}

// Bind validates and binds request data to a struct
func (v *APIValidator) Bind(c *gin.Context, obj any) []ValidationError {
	// Bind request to struct
	if err := c.ShouldBind(obj); err != nil {
		return []ValidationError{{
			Field:   "request",
			Message: "Invalid request format",
			Tag:     "binding",
			Value:   "",
		}}
	}

	// Validate struct
	return v.ValidateStruct(obj)
}

// Custom validation functions
func validateDateTime(fl validator.FieldLevel) bool {
	format := fl.Param()
	dateStr := fl.Field().String()

	_, err := time.Parse(format, dateStr)
	return err == nil
}
