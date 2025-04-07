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

	// Metadata
	//RawData json.RawMessage `json:"raw_data,omitempty" gorm:"type:text"`
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

// CPTResult represents the results of a Continuous Performance Test
type CPTResult struct {
	ID                  uint            `json:"id" gorm:"primaryKey"`
	UserEmail           string          `json:"user_email" gorm:"index"`
	DeviceID            string          `json:"device_id" gorm:"index"`
	AssessmentID        uint            `json:"assessment_id" gorm:"index"`
	TestStartTime       time.Time       `json:"test_start_time"`
	TestEndTime         time.Time       `json:"test_end_time"`
	CorrectDetections   int             `json:"correct_detections"`
	CommissionErrors    int             `json:"commission_errors"`
	OmissionErrors      int             `json:"omission_errors"`
	AverageReactionTime float64         `json:"average_reaction_time"`
	ReactionTimeSD      float64         `json:"reaction_time_sd"`
	DetectionRate       float64         `json:"detection_rate"`
	OmissionErrorRate   float64         `json:"omission_error_rate"`
	CommissionErrorRate float64         `json:"commission_error_rate"`
	RawData             json.RawMessage `json:"raw_data" gorm:"type:json"` // Store full test data
	CreatedAt           time.Time       `json:"created_at"`

	// Relationships
	User       User       `json:"-" gorm:"foreignKey:UserEmail"`
	Device     Device     `json:"-" gorm:"foreignKey:DeviceID"`
	Assessment Assessment `json:"-" gorm:"foreignKey:AssessmentID"`
}

// JSON is a custom type for handling JSON data in the database
type JSON map[string]any

// Value implements the driver.Valuer interface for JSON
func (j JSON) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}

	bytes, err := json.Marshal(j)
	return string(bytes), err
}

// Scan implements the sql.Scanner interface for JSON
func (j *JSON) Scan(value any) error {
	var bytes []byte

	switch v := value.(type) {
	case []byte:
		bytes = v
	case string:
		bytes = []byte(v)
	case nil:
		*j = make(JSON)
		return nil
	default:
		return fmt.Errorf("unsupported type for JSON scanning: %T", value)
	}

	if len(bytes) == 0 {
		*j = make(JSON)
		return nil
	}

	result := make(JSON)
	err := json.Unmarshal(bytes, &result)
	*j = result
	return err
}
