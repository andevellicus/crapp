package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

type User struct {
	Email            string    `json:"email" gorm:"primaryKey"`
	Password         []byte    `json:"-"` // Stored as bcrypt hash, omitted from JSON
	FirstName        string    `json:"first_name,omitempty"`
	LastName         string    `json:"last_name,omitempty"`
	IsAdmin          bool      `json:"is_admin" gorm:"default:false"`
	CreatedAt        time.Time `json:"created_at"`
	LastLogin        time.Time `json:"last_login"`
	PushSubscription string    `json:"push_subscription,omitempty" gorm:"type:text"`
	PushPreferences  string    `json:"push_preferences,omitempty" gorm:"type:text"`

	// Relationships
	Devices     []Device     `json:"devices,omitempty" gorm:"foreignKey:UserEmail"`
	Assessments []Assessment `json:"assessments,omitempty" gorm:"foreignKey:UserEmail"`
}

// Device represents a user's device
type Device struct {
	ID         string    `json:"id" gorm:"primaryKey"`
	UserEmail  string    `json:"user_email" gorm:"index"`
	DeviceName string    `json:"device_name,omitempty"`
	DeviceType string    `json:"device_type"` // mobile, tablet, desktop
	Browser    string    `json:"browser,omitempty"`
	OS         string    `json:"os,omitempty"`
	LastActive time.Time `json:"last_active"`
	CreatedAt  time.Time `json:"created_at"`

	// Relationships
	User        User         `json:"-" gorm:"foreignKey:UserEmail"`
	Assessments []Assessment `json:"assessments,omitempty" gorm:"foreignKey:DeviceID"`
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

	bytes, err := json.Marshal(j)
	return string(bytes), err
}

// Scan implements the sql.Scanner interface for JSON
func (j *JSON) Scan(value interface{}) error {
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
