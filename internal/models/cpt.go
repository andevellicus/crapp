// internal/models/cognitive_test.go
package models

import (
	"encoding/json"
)

type TestType int

const (
	CPTest = iota
	TrailMaking
	ErrorState
)

// CognitiveTestResult represents a simplified cognitive test result
// for inclusion in form submissions
type CognitiveTestResult struct {
	QuestionID string          `json:"question_id"`
	Results    json.RawMessage `json:"results"`
}
