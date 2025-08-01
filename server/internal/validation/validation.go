// internal/validation/validation.go
package validation

// ValidationError represents a single validation error
type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
	Tag     string `json:"tag,omitempty"`
	Value   string `json:"value,omitempty"`
}

// ValidationResponse represents a complete validation response
type ValidationResponse struct {
	Valid   bool              `json:"valid"`
	Errors  []ValidationError `json:"errors,omitempty"`
	Message string            `json:"message,omitempty"`
	Field   string            `json:"field,omitempty"` // Field to focus on client-side
}

// NewValidationError creates a new validation error
func NewValidationError(field, message string) ValidationError {
	return ValidationError{
		Field:   field,
		Message: message,
	}
}

// NewValidationResponse creates a new validation response
func NewValidationResponse(valid bool, message string, errors []ValidationError) ValidationResponse {
	return ValidationResponse{
		Valid:   valid,
		Message: message,
		Errors:  errors,
	}
}
