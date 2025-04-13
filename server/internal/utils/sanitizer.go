// internal/utils/sanitizer.go
package utils

import "github.com/microcosm-cc/bluemonday"

// SanitizeHTML sanitizes HTML input for safety
func SanitizeHTML(input string) string {
	p := bluemonday.UGCPolicy()
	return p.Sanitize(input)
}
