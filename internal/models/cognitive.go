package models

import (
	"encoding/json"
	"time"
)

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

// TMTResult represents the results of a Trail Making Test
type TMTResult struct {
	ID                  uint            `json:"id" gorm:"primaryKey"`
	UserEmail           string          `json:"user_email" gorm:"index"`
	DeviceID            string          `json:"device_id" gorm:"index"`
	AssessmentID        uint            `json:"assessment_id" gorm:"index"`
	TestStartTime       time.Time       `json:"test_start_time"`
	TestEndTime         time.Time       `json:"test_end_time"`
	PartACompletionTime float64         `json:"part_a_completion_time"`
	PartAErrors         int             `json:"part_a_errors"`
	PartBCompletionTime float64         `json:"part_b_completion_time"`
	PartBErrors         int             `json:"part_b_errors"`
	BToARatio           float64         `json:"b_to_a_ratio"`
	RawData             json.RawMessage `json:"raw_data" gorm:"type:json"`
	CreatedAt           time.Time       `json:"created_at"`

	// Relationships
	User       User       `json:"-" gorm:"foreignKey:UserEmail"`
	Device     Device     `json:"-" gorm:"foreignKey:DeviceID"`
	Assessment Assessment `json:"-" gorm:"foreignKey:AssessmentID"`
}
