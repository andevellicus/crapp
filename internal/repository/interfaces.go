// repository/interfaces.go

package repository

import (
	"encoding/json"

	"github.com/andevellicus/crapp/internal/models"
)

// UserRepository defines the operations available for user management
type UserDB interface {
	Create(user *models.User) error
	GetByEmail(email string) (*models.User, error)
	Update(user *models.User) error
	Delete(email string) error

	UserExists(email string) (bool, error)
	UpdatePassword(email string, hashedPassword []byte) error
	HasCompletedAssessment(userEmail string) (bool, error)
	SearchUsers(query string, skip, limit int) ([]models.User, int64, error)
}

type DeviceDB interface {
	Create(device *models.Device) error
	GetByID(id string) (*models.Device, error)
	Update(device *models.Device) error
	Delete(id string) error

	GetUserDevices(userEmail string) ([]models.Device, error)
	RegisterDevice(userEmail string, deviceInfo map[string]any) (*models.Device, error)
	UpdateDeviceName(deviceID string, userEmail string, newName string) error
}

type AsessmentDB interface {
	Create(assessment *models.AssessmentSubmission) (uint, error)

	GetMetricsCorrelation(userID, symptomKey, metricKey string) ([]CorrelationDataPoint, error)
	GetMetricsTimeline(userID, symptomKey, metricKey string) ([]TimelineDataPoint, error)
	saveStructuredResponses(assessmentID uint, responses models.JSON) error
	extractAndSaveMetrics(assessmentID uint, metadata json.RawMessage) error
}

type FormStateDB interface {
	Create(userEmail string, questionOrder []int) (*models.FormState, error)
	GetByID(id string) (*models.FormState, error)
	Update(formState *models.FormState) error
	Delete(id string) error

	SaveFormAnswer(stateID string, questionID string, answer any) error
	GetUserActiveFormState(userEmail string) (*models.FormState, error)
}

type RefreshTokenDB interface {
	Create(revokedToken *models.RefreshToken) error
	Get(tokenString string) (*models.RefreshToken, error)

	Delete(tokenString string) error
}

type RevokedTokenDB interface {
	Create(revokedToken *models.RevokedToken) error

	IsTokenRevoked(tokenID string) (bool, error)
	RevokeToken(tokenID string) error
	RevokeAllUserTokens(email string) error
}

type PasswordResetTokenDB interface {
	Create(userEmail string, expiresInMinutes int) (*models.PasswordResetToken, error)

	ValidatePasswordResetToken(tokenStr string) (*models.PasswordResetToken, error)
	MarkTokenAsUsed(tokenStr string) error
}

type CognitiveTestDB interface {
	SaveCPTResults(results *models.CPTResult, assessmentID uint) (uint, error)
	GetCPTResults(userEmail string, limit int) ([]models.CPTResult, error)
	GetCPTResultsByAssessment(assessmentID uint) (*models.CPTResult, error)
	GetCPTResultByID(id uint) (*models.CPTResult, error)
	GetCPTMetrics(userEmail string, lastDays int) (map[string]float64, error)
}
