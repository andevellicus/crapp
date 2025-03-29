// internal/validation/form_validation.go
package validation

import (
	"fmt"

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

// ValidateAnswer validates a single answer against its question
func (v *FormValidator) ValidateAnswer(questionID string, answer interface{}) []ValidationError {
	var errors []ValidationError

	// Get question definition
	question := v.questionLoader.GetQuestionByID(questionID)
	if question == nil {
		errors = append(errors, NewValidationError(questionID, "Invalid question ID"))
		return errors
	}

	// Check required fields
	if question.Required {
		// Handle nil or empty values
		if answer == nil {
			errors = append(errors, NewValidationError(questionID, "This question is required"))
			return errors
		}

		// Check empty strings
		if str, ok := answer.(string); ok && str == "" {
			errors = append(errors, NewValidationError(questionID, "This question is required"))
			return errors
		}
	}

	// Type-specific validation
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

// ValidateForm validates an entire form submission
func (v *FormValidator) ValidateForm(answers map[string]interface{}) ValidationResponse {
	var allErrors []ValidationError

	// Validate each answer
	for questionID, answer := range answers {
		errors := v.ValidateAnswer(questionID, answer)
		allErrors = append(allErrors, errors...)
	}

	// Check if all required questions are answered
	questions := v.questionLoader.GetQuestions()
	for _, question := range questions {
		if question.Required {
			if _, exists := answers[question.ID]; !exists {
				allErrors = append(allErrors, NewValidationError(
					question.ID, "This question is required"))
			}
		}
	}

	// Create response
	valid := len(allErrors) == 0
	message := "Validation successful"
	if !valid {
		message = "Validation failed"
	}

	return NewValidationResponse(valid, message, allErrors)
}

// Validate radio button answer
func (v *FormValidator) validateRadioAnswer(question *utils.Question, answer interface{}) []ValidationError {
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
		errors = append(errors, NewValidationError(
			question.ID, "Invalid answer type"))
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
		errors = append(errors, NewValidationError(
			question.ID, "Invalid option selected"))
	}

	return errors
}

// Similarly implement validateDropdownAnswer and validateTextAnswer
func (v *FormValidator) validateDropdownAnswer(question *utils.Question, answer interface{}) []ValidationError {
	// Similar to radio validation
	return v.validateRadioAnswer(question, answer)
}

func (v *FormValidator) validateTextAnswer(question *utils.Question, answer interface{}) []ValidationError {
	var errors []ValidationError

	str, ok := answer.(string)
	if !ok {
		errors = append(errors, NewValidationError(
			question.ID, "Answer must be text"))
		return errors
	}

	// Check max length if specified
	if question.MaxLength > 0 && len(str) > question.MaxLength {
		errors = append(errors, NewValidationError(
			question.ID, fmt.Sprintf("Text exceeds maximum length of %d characters", question.MaxLength)))
	}

	return errors
}
