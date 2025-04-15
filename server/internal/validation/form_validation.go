// internal/validation/form_validation.go
package validation

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/andevellicus/crapp/internal/utils"
)

// FormValidator handles form validation
type FormValidator struct {
	questionLoader *utils.QuestionLoader
}

// NewFormValidator creates a new form validator
func NewFormValidator(questionLoader *utils.QuestionLoader) *FormValidator {
	return &FormValidator{
		questionLoader: questionLoader,
	}
}

// ValidateAnswer validates a single answer against its question with enhanced checks
func (v *FormValidator) ValidateAnswer(questionID string, answer any) []ValidationError {
	var errors []ValidationError

	// Get question definition
	question := v.questionLoader.GetQuestionByID(questionID)
	if question == nil {
		errors = append(errors, ValidationError{
			Field:   questionID,
			Message: "Invalid question ID",
		})
		return errors
	}

	// Check required fields
	if question.Required {
		if IsEmptyAnswer(answer) {
			errors = append(errors, ValidationError{
				Field:   questionID,
				Message: "This question is required",
			})
			return errors
		}
	}

	// Type-specific validation with enhanced checks
	switch question.Type {
	case "radio":
		errors = append(errors, v.validateRadioAnswer(question, answer)...)
	case "dropdown":
		errors = append(errors, v.validateDropdownAnswer(question, answer)...)
	case "text":
		errors = append(errors, v.validateTextAnswer(question, answer)...)
	}

	return errors
}

// Helper to check if answer is empty
func IsEmptyAnswer(answer any) bool {
	if answer == nil {
		return true
	}
	switch v := answer.(type) {
	case string:
		return strings.TrimSpace(v) == ""
	case []any:
		return len(v) == 0
	default:
		return false
	}
}

// Validate radio button answer
func (v *FormValidator) validateRadioAnswer(question *utils.Question, answer any) []ValidationError {
	var errors []ValidationError

	// Convert answer to string for comparison
	var answerStr string
	switch v := answer.(type) {
	case string:
		answerStr = v
	case float64:
		answerStr = fmt.Sprintf("%g", v)
	case int:
		answerStr = fmt.Sprintf("%d", v)
	default:
		errors = append(errors, ValidationError{
			Field:   question.ID,
			Message: "Invalid answer type",
		})
		return errors
	}

	// Validate against allowed options
	valid := false
	for _, option := range question.Options {
		// Convert option value to string for comparison
		var optionStr string
		switch v := option.Value.(type) {
		case string:
			optionStr = v
		case float64:
			optionStr = fmt.Sprintf("%g", v)
		case int:
			optionStr = fmt.Sprintf("%d", v)
		default:
			continue
		}

		if answerStr == optionStr {
			valid = true
			break
		}
	}

	if !valid {
		errors = append(errors, ValidationError{
			Field:   question.ID,
			Message: "Invalid option selected",
		})
	}

	return errors
}

func (v *FormValidator) validateDropdownAnswer(question *utils.Question, answer any) []ValidationError {
	var errors []ValidationError

	// If no answer:
	if answer == nil {
		answer = ""
	}

	// Convert answer to string for comparison
	var answerStr string
	switch v := answer.(type) {
	case string:
		answerStr = v
	case float64:
		answerStr = fmt.Sprintf("%g", v)
	case int:
		answerStr = fmt.Sprintf("%d", v)
	default:
		// For other types, convert to string
		answerStr = fmt.Sprintf("%v", answer)
	}

	// Skip validation for empty answers on non-required fields
	if answerStr == "" && !question.Required {
		return errors
	}

	// Required field check
	if answerStr == "" && question.Required {
		errors = append(errors, ValidationError{
			Field:   question.ID,
			Message: "This question is required",
		})
		return errors
	}

	// Validate against allowed options
	valid := false
	for _, option := range question.Options {
		// Convert option value to string for comparison
		var optionStr string
		switch v := option.Value.(type) {
		case string:
			optionStr = v
		case float64:
			optionStr = fmt.Sprintf("%g", v)
		case int:
			optionStr = fmt.Sprintf("%d", v)
		default:
			optionStr = fmt.Sprintf("%v", option.Value)
		}

		if answerStr == optionStr {
			valid = true
			break
		}
	}

	if !valid && answerStr != "" {
		errors = append(errors, ValidationError{
			Field:   question.ID,
			Message: "Invalid option selected",
		})
	}

	return errors
}

// Enhanced text validation
func (v *FormValidator) validateTextAnswer(question *utils.Question, answer any) []ValidationError {
	var errors []ValidationError

	// If no answer:
	if answer == nil {
		answer = ""
	}

	str, ok := answer.(string)
	if !ok {
		errors = append(errors, ValidationError{
			Field:   question.ID,
			Message: "Answer must be text",
		})
		return errors
	}

	// Check max length
	if question.MaxLength > 0 && len(str) > question.MaxLength {
		errors = append(errors, ValidationError{
			Field:   question.ID,
			Message: fmt.Sprintf("Text exceeds maximum length of %d characters", question.MaxLength),
		})
	}

	// Add pattern validation if defined in the question model
	if question.Pattern != "" {
		re, err := regexp.Compile(question.Pattern)
		if err == nil && !re.MatchString(str) {
			var errorMessage string
			if question.PatternMessage != "" {
				errorMessage = question.PatternMessage
			} else {
				errorMessage = "Text does not match required format"
			}
			errors = append(errors, ValidationError{
				Field:   question.ID,
				Message: errorMessage,
			})
		}
	}

	return errors
}

// ValidateForm validates an entire form submission
func (v *FormValidator) ValidateForm(answers map[string]any) ValidationResponse {
	var allErrors []ValidationError

	// Validate each answer
	for questionID, answer := range answers {
		// Navigation doesn't have any answers
		if questionID == "navigation" {
			continue
		}
		errors := v.ValidateAnswer(questionID, answer)
		allErrors = append(allErrors, errors...)
	}

	// Check if all required questions are answered
	questions := v.questionLoader.GetQuestions()
	for _, question := range questions {
		if question.Required {
			if _, exists := answers[question.ID]; !exists {
				allErrors = append(allErrors, ValidationError{
					Field:   question.ID,
					Message: "This question is required",
				})
			}
		}
	}

	// Create response
	valid := len(allErrors) == 0
	message := "Validation successful"
	if !valid {
		message = "Validation failed"
	}

	return ValidationResponse{
		Valid:   valid,
		Message: message,
		Errors:  allErrors,
	}
}
