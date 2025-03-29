// internal/validation/messages.go
package validation

// ValidationMessages contains all validation error messages
var ValidationMessages = struct {
	Required       string
	InvalidOption  string
	MaxLength      string
	InvalidFormat  string
	InvalidType    string
	DefaultMessage string
}{
	Required:       "This question is required",
	InvalidOption:  "Invalid option selected",
	MaxLength:      "Text exceeds maximum length of %d characters",
	InvalidFormat:  "Input does not match required format",
	InvalidType:    "Invalid answer type",
	DefaultMessage: "Invalid response",
}
