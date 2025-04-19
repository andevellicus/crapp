package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// Assessment represents a submitted symptom assessment
type Assessment struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	UserEmail   string    `json:"user_email" gorm:"index"`
	DeviceID    string    `json:"device_id" gorm:"index"`
	SubmittedAt time.Time `json:"submitted_at" gorm:"default:CURRENT_TIMESTAMP"`

	// --- Location Fields for PostgreSQL ---
	// Store permission status ('granted', 'denied', 'prompt', 'unavailable', 'unknown')
	LocationPermission string `json:"location_permission" gorm:"type:varchar(20);not null"` // Added not null constraint
	// Use pointers for nullable float fields, map to double precision for accuracy
	Latitude  *float64 `json:"latitude" gorm:"type:double precision"`
	Longitude *float64 `json:"longitude" gorm:"type:double precision"`
	// Use pointer for nullable string field
	LocationError *string `json:"location_error" gorm:"type:text"`
}

// QuestionResponse represents a response to a specific question
type QuestionResponse struct {
	ID           uint      `json:"id" gorm:"primaryKey"`
	AssessmentID uint      `json:"assessment_id" gorm:"index"`
	QuestionID   string    `json:"question_id" gorm:"index"` // Maps to questions.yaml IDs
	ValueType    string    `json:"value_type"`               // "number", "string", "boolean"
	NumericValue float64   `json:"numeric_value"`            // For radio buttons, scales, etc.
	TextValue    string    `json:"text_value"`               // For text inputs
	CreatedAt    time.Time `json:"created_at"`

	// Relationships
	Assessment Assessment `json:"-" gorm:"foreignKey:AssessmentID"`
}

// JSON is a custom type for handling JSON data in the database
type JSON map[string]any

// Value implements the driver.Valuer interface for JSON
func (j JSON) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

// Scan implements the sql.Scanner interface for JSON
func (j *JSON) Scan(value any) error {
	if value == nil {
		*j = nil
		return nil
	}

	var bytes []byte
	switch v := value.(type) {
	case string:
		bytes = []byte(v)
	case []byte:
		bytes = v
	default:
		return fmt.Errorf("failed to unmarshal JSONB value: %v", value)
	}

	return json.Unmarshal(bytes, j)
}
