package models

import "time"

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
