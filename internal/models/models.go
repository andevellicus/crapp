package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// User represents a user in the system
type User struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	Email     string    `json:"email,omitempty" gorm:"uniqueIndex"`
	CreatedAt time.Time `json:"created_at"`
	LastLogin time.Time `json:"last_login"`

	// Relationships
	Assessments []Assessment `json:"assessments,omitempty" gorm:"foreignKey:UserID"`
}

// Assessment represents a submitted symptom assessment
type Assessment struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	UserID      string    `json:"user_id" gorm:"index"`
	Date        time.Time `json:"date" gorm:"default:CURRENT_TIMESTAMP"`
	SubmittedAt time.Time `json:"submitted_at" gorm:"default:CURRENT_TIMESTAMP"`

	// Responses (stored as JSON)
	Responses JSON `json:"responses" gorm:"type:text"`

	// Global Interaction metrics
	ClickPrecision      *float64 `json:"click_precision,omitempty"`
	PathEfficiency      *float64 `json:"path_efficiency,omitempty"`
	OvershootRate       *float64 `json:"overshoot_rate,omitempty"`
	AverageVelocity     *float64 `json:"average_velocity,omitempty"`
	VelocityVariability *float64 `json:"velocity_variability,omitempty"`

	// Per-question metrics (stored as JSON)
	QuestionMetrics JSON `json:"question_metrics,omitempty" gorm:"type:text"`

	// Metadata
	RawData JSON `json:"raw_data,omitempty" gorm:"type:text"`
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

// AssessmentSubmission is used for incoming API requests
type AssessmentSubmission struct {
	UserID    string          `json:"user_id"`
	Responses JSON            `json:"responses"`
	Metadata  json.RawMessage `json:"metadata,omitempty"`
}

// SubmissionResponse is sent back after processing a submission
type SubmissionResponse struct {
	Status       string `json:"status"`
	AssessmentID uint   `json:"assessment_id"`
}

// AssessmentSummary is used for API responses
type AssessmentSummary struct {
	ID                 uint      `json:"id"`
	Date               time.Time `json:"date"`
	Responses          JSON      `json:"responses"`
	InteractionMetrics struct {
		ClickPrecision      *float64 `json:"click_precision,omitempty"`
		PathEfficiency      *float64 `json:"path_efficiency,omitempty"`
		OvershootRate       *float64 `json:"overshoot_rate,omitempty"`
		AverageVelocity     *float64 `json:"average_velocity,omitempty"`
		VelocityVariability *float64 `json:"velocity_variability,omitempty"`
	} `json:"interaction_metrics"`
	QuestionMetrics JSON `json:"question_metrics,omitempty"`
	RawData         JSON `json:"raw_data,omitempty"`
}
