// internal/models/models.go (update the User model)
package models

import (
	"time"
)

// Represents a user in the database
type User struct {
	Email              string    `json:"email" gorm:"primaryKey"`
	Password           []byte    `json:"-"` // Stored as bcrypt hash, omitted from JSON
	FirstName          string    `json:"first_name,omitempty"`
	LastName           string    `json:"last_name,omitempty"`
	IsAdmin            bool      `json:"is_admin" gorm:"default:false"`
	CreatedAt          time.Time `json:"created_at"`
	LastLogin          time.Time `json:"last_login"`
	PushSubscription   string    `json:"push_subscription,omitempty" gorm:"type:text"`
	PushPreferences    string    `json:"push_preferences,omitempty" gorm:"type:text"`
	LastAssessmentDate time.Time `json:"last_assessment_date,omitempty"`

	// Relationships
	Devices     []Device     `json:"devices,omitempty" gorm:"foreignKey:UserEmail"`
	Assessments []Assessment `json:"assessments,omitempty" gorm:"foreignKey:UserEmail"`
}
