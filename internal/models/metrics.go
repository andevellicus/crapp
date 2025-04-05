package models

import "time"

// AssessmentMetric represents an indexed metric for efficient querying
type AssessmentMetric struct {
	ID           uint      `json:"id" gorm:"primaryKey"`
	AssessmentID uint      `json:"assessment_id" gorm:"index"`
	QuestionID   string    `json:"question_id" gorm:"index"`
	MetricKey    string    `json:"metric_key" gorm:"index"`
	MetricValue  float64   `json:"metric_value"`
	SampleSize   int       `json:"sample_size"`
	CreatedAt    time.Time `json:"created_at"`

	// Relationships
	Assessment Assessment `json:"-" gorm:"foreignKey:AssessmentID"`
}
