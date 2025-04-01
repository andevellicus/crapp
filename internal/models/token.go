// internal/models/token.go
package models

import (
	"time"
)

// RefreshToken represents a refresh token in the database
type RefreshToken struct {
	Token     string     `json:"token" gorm:"primaryKey"`
	UserEmail string     `json:"user_email" gorm:"index"`
	DeviceID  string     `json:"device_id" gorm:"index"`
	TokenID   string     `json:"token_id" gorm:"index"` // JWT ID reference
	ExpiresAt time.Time  `json:"expires_at"`
	CreatedAt time.Time  `json:"created_at"`
	RevokedAt *time.Time `json:"revoked_at"`
}

// RevokedToken represents a revoked JWT token
type RevokedToken struct {
	TokenID   string    `json:"token_id" gorm:"primaryKey"` // JWT ID
	UserEmail string    `json:"user_email" gorm:"index"`
	RevokedAt time.Time `json:"revoked_at"`
	ExpiresAt time.Time `json:"expires_at"` // For cleanup purposes
}

// PasswordResetToken represents a password reset token
type PasswordResetToken struct {
	Token     string     `json:"token" gorm:"primaryKey"`
	UserEmail string     `json:"user_email" gorm:"index"`
	ExpiresAt time.Time  `json:"expires_at"`
	CreatedAt time.Time  `json:"created_at"`
	UsedAt    *time.Time `json:"used_at"`
}

// Add this method to make RefreshToken implement the Entity interface
func (t RefreshToken) GetID() any {
	return t.Token
}

// Add this method to make RevokedToken implement the Entity interface
func (t RevokedToken) GetID() any {
	return t.TokenID
}

// Add this method to make User implement the Entity interface
func (t PasswordResetToken) GetID() any {
	return t.Token
}
