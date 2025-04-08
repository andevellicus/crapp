// internal/validation/models.go
package validation

import (
	"encoding/json"
)

// Auth validation models
type RegisterRequest struct {
	Email     string `json:"email" validate:"required,email"`
	Password  string `json:"password" validate:"required,min=8"`
	FirstName string `json:"first_name" validate:"required"`
	LastName  string `json:"last_name" validate:"required"`
}

type LoginRequest struct {
	Email      string         `json:"email" validate:"required,email"`
	Password   string         `json:"password" validate:"required"`
	DeviceInfo map[string]any `json:"device_info"`
}

type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

// User validation models
type UpdateUserRequest struct {
	FirstName       string `json:"first_name" validate:"required"`
	LastName        string `json:"last_name" validate:"required"`
	CurrentPassword string `json:"current_password" validate:"omitempty"`
	NewPassword     string `json:"new_password" validate:"omitempty,min=8"`
}

// Device validation models
type RegisterDeviceRequest struct {
	DeviceName string         `json:"device_name" validate:"required"`
	DeviceType string         `json:"device_type" validate:"required"`
	UserAgent  string         `json:"user_agent"`
	OS         string         `json:"os"`
	ScreenSize map[string]any `json:"screen_size"`
}

type RenameDeviceRequest struct {
	DeviceName string `json:"device_name" validate:"required"`
}

// Form validation models
type SaveAnswerRequest struct {
	QuestionID      string          `json:"question_id" validate:"required"`
	Answer          any             `json:"answer"`
	Direction       string          `json:"direction" validate:"required,oneof=next prev"`
	InteractionData json.RawMessage `json:"interaction_data,omitempty"`
	CPTData         json.RawMessage `json:"cpt_data,omitempty"`
}

// Push validation models
type PushSubscriptionRequest struct {
	Endpoint string `json:"endpoint" validate:"required"`
	Keys     struct {
		P256dh string `json:"p256dh" validate:"required"`
		Auth   string `json:"auth" validate:"required"`
	} `json:"keys" validate:"required"`
	ExpirationTime *int64 `json:"expirationTime,omitempty"`
}

// NotificationPreferencesRequest for the UpdatePreferences endpoint
type NotificationPreferencesRequest struct {
	PushEnabled   bool     `json:"push_enabled"`
	EmailEnabled  bool     `json:"email_enabled"`
	ReminderTimes []string `json:"reminder_times" validate:"required,dive,datetime=15:04"`
}

// ForgotPasswordRequest represents a password reset request
type ForgotPasswordRequest struct {
	Email string `json:"email" validate:"required,email"`
}

// ResetPasswordRequest represents a password reset submission
type ResetPasswordRequest struct {
	Token       string `json:"token" validate:"required"`
	NewPassword string `json:"new_password" validate:"required,min=8"`
}

type DeleteAccountRequest struct {
	Password string `json:"password" validate:"required"`
}

// AdminReminderRequest represents a request to send a reminder to a user
type AdminReminderRequest struct {
	Email  string `json:"email" binding:"required,email"`
	Method string `json:"method" binding:"required,oneof=email push"` // "email" or "push"
}
