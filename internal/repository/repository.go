package repository

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"strings"
	"time"

	"github.com/andevellicus/crapp/internal/models"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// Repository handles all database operations
type Repository struct {
	db  *gorm.DB
	log *zap.SugaredLogger
}

// NewRepository creates a new repository with the given database connection
func NewRepository(db *gorm.DB, log *zap.SugaredLogger) *Repository {
	return &Repository{
		db:  db,
		log: log.Named("repository"),
	}
}

// CreateAssessment creates a new assessment from submission data
func (r *Repository) CreateAssessment(assessment *models.AssessmentSubmission) (uint, error) {
	// Check if user exists
	exists, err := r.UserExists(assessment.UserEmail)
	if err != nil {
		return 0, fmt.Errorf("error checking user: %w", err)
	}
	if !exists {
		return 0, fmt.Errorf("user not found: %s", assessment.UserEmail)
	}

	// Check if device exists and belongs to user
	var device models.Device
	result := r.db.Where("id = ? AND user_email = ?", assessment.DeviceID, assessment.UserEmail).First(&device)
	if result.Error != nil {
		return 0, fmt.Errorf("device not found or doesn't belong to user: %w", result.Error)
	}

	// Update device last active time
	device.LastActive = time.Now()
	r.db.Save(&device)

	// Extract interaction metrics if available
	var clickPrecision, pathEfficiency, overshootRate, avgVelocity, velocityVar *float64
	var questionMetrics models.JSON

	if assessment.Metadata != nil {
		var metadata map[string]interface{}
		if err := json.Unmarshal(assessment.Metadata, &metadata); err != nil {
			return 0, err
		}

		if interactionMetrics, ok := metadata["interaction_metrics"].(map[string]interface{}); ok {
			if val, ok := interactionMetrics["clickPrecision"].(float64); ok {
				clickPrecision = &val
			}
			if val, ok := interactionMetrics["pathEfficiency"].(float64); ok {
				pathEfficiency = &val
			}
			if val, ok := interactionMetrics["overShootRate"].(float64); ok {
				overshootRate = &val
			}
			if val, ok := interactionMetrics["averageVelocity"].(float64); ok {
				avgVelocity = &val
			}
			if val, ok := interactionMetrics["velocityVariability"].(float64); ok {
				velocityVar = &val
			}
		}

		if qMetrics, ok := metadata["question_metrics"].(map[string]interface{}); ok {
			questionMetrics = models.JSON(qMetrics)
		}
	}

	// Create assessment record
	newAssessment := models.Assessment{
		UserEmail:           assessment.UserEmail,
		DeviceID:            assessment.DeviceID,
		Date:                time.Now(),
		SubmittedAt:         time.Now(),
		Responses:           assessment.Responses,
		ClickPrecision:      clickPrecision,
		PathEfficiency:      pathEfficiency,
		OvershootRate:       overshootRate,
		AverageVelocity:     avgVelocity,
		VelocityVariability: velocityVar,
		QuestionMetrics:     questionMetrics,
	}

	// Convert the original submission to raw data
	rawDataBytes, err := json.Marshal(assessment)
	if err == nil {
		var rawData models.JSON
		_ = json.Unmarshal(rawDataBytes, &rawData)
		newAssessment.RawData = rawData
	}

	result = r.db.Create(&newAssessment)
	if result.Error != nil {
		return 0, result.Error
	}

	return newAssessment.ID, nil
}

// GetAssessment retrieves an assessment by ID
func (r *Repository) GetAssessment(assessmentID uint) (*models.Assessment, error) {
	var assessment models.Assessment
	result := r.db.First(&assessment, assessmentID)
	if result.Error != nil {
		return nil, result.Error
	}
	return &assessment, nil
}

// GetAssessmentsByUser retrieves assessments for a user
func (r *Repository) GetAssessmentsByUser(userID string, skip, limit int) ([]models.AssessmentSummary, error) {
	var assessments []models.Assessment

	query := r.db.Where("user_id = ?", userID).
		Order("date DESC").
		Offset(skip).
		Limit(limit)

	result := query.Find(&assessments)
	if result.Error != nil {
		return nil, result.Error
	}

	// Convert to summary format
	summaries := make([]models.AssessmentSummary, len(assessments))
	for i, assessment := range assessments {
		summary := models.AssessmentSummary{
			ID:              assessment.ID,
			Date:            assessment.Date,
			Responses:       assessment.Responses,
			QuestionMetrics: assessment.QuestionMetrics,
			RawData:         assessment.RawData,
		}

		// Set interaction metrics
		if assessment.ClickPrecision != nil {
			summary.InteractionMetrics.ClickPrecision = assessment.ClickPrecision
		}
		if assessment.PathEfficiency != nil {
			summary.InteractionMetrics.PathEfficiency = assessment.PathEfficiency
		}
		if assessment.OvershootRate != nil {
			summary.InteractionMetrics.OvershootRate = assessment.OvershootRate
		}
		if assessment.AverageVelocity != nil {
			summary.InteractionMetrics.AverageVelocity = assessment.AverageVelocity
		}
		if assessment.VelocityVariability != nil {
			summary.InteractionMetrics.VelocityVariability = assessment.VelocityVariability
		}

		summaries[i] = summary
	}

	return summaries, nil
}

// CreateUser creates a new user
func (r *Repository) CreateUser(user *models.User) error {
	result := r.db.Create(user)
	return result.Error
}

// GetUser retrieves a user by email
func (r *Repository) GetUser(email string) (*models.User, error) {
	var user models.User
	result := r.db.Where("email = ?", email).First(&user)
	if result.Error != nil {
		return nil, result.Error
	}

	return &user, nil
}

// UserExists checks if a user with the given email exists
func (r *Repository) UserExists(email string) (bool, error) {
	var count int64
	result := r.db.Model(&models.User{}).Where("email = ?", email).Count(&count)
	return count > 0, result.Error
}

// UpdateUser updates an existing user
func (r *Repository) UpdateUser(user *models.User) error {
	result := r.db.Save(user)
	return result.Error
}

// UpdateUserLogin updates a user's last login time
func (r *Repository) UpdateUserLogin(userID string) (*models.User, error) {
	var user models.User
	result := r.db.First(&user, "id = ?", userID)
	if result.Error != nil {
		return nil, result.Error
	}

	user.LastLogin = time.Now()
	result = r.db.Save(&user)
	if result.Error != nil {
		return nil, result.Error
	}

	return &user, nil
}

// RegisterDevice registers a new device or updates an existing one
func (r *Repository) RegisterDevice(userEmail string, deviceInfo map[string]interface{}) (*models.Device, error) {
	// Check if user exists
	if _, err := r.GetUser(userEmail); err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	// Generate device ID if not provided
	var deviceID string

	// Try to find existing device with similar user agent
	userAgent, hasUA := deviceInfo["user_agent"].(string)

	if hasUA {
		var existingDevices []models.Device
		r.db.Where("user_email = ?", userEmail).Find(&existingDevices)

		// Look for a device with a matching user agent
		for _, device := range existingDevices {
			// No type assertion needed since Browser is already a string
			if device.Browser != "" && strings.Contains(userAgent, device.Browser) {
				// Found a matching device, update it
				deviceID = device.ID
				break
			}
		}
	}

	// If no existing device found, generate a new ID
	if deviceID == "" {
		deviceID = generateDeviceID()
	}

	// Extract device information
	deviceName, _ := deviceInfo["device_name"].(string)
	deviceType, _ := deviceInfo["device_type"].(string)
	browser, _ := deviceInfo["user_agent"].(string)
	os, _ := deviceInfo["os"].(string)

	// Create or update device
	device := models.Device{
		ID:         deviceID,
		UserEmail:  userEmail,
		DeviceName: deviceName,
		DeviceType: deviceType,
		Browser:    browser,
		OS:         os,
		LastActive: time.Now(),
		CreatedAt:  time.Now(),
	}

	// Save to database (upsert)
	result := r.db.Save(&device)
	if result.Error != nil {
		return nil, result.Error
	}

	return &device, nil
}

// generateDeviceID generates a random device ID
func generateDeviceID() string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, 16)
	for i := range b {
		b[i] = charset[rand.Int63()%int64(len(charset))]
	}

	return string(b)
}

// GetUserDevices retrieves all devices for a user
func (r *Repository) GetUserDevices(userEmail string) ([]models.Device, error) {
	var devices []models.Device

	result := r.db.Where("user_email = ?", userEmail).Find(&devices)
	if result.Error != nil {
		return nil, result.Error
	}

	return devices, nil
}

// GetDevice retrieves a device by ID
func (r *Repository) GetDevice(deviceID string) (*models.Device, error) {
	var device models.Device

	result := r.db.Where("id = ?", deviceID).First(&device)
	if result.Error != nil {
		return nil, result.Error
	}

	return &device, nil
}

// DeleteDevice removes a device
func (r *Repository) DeleteDevice(deviceID string, userEmail string) error {
	// Verify the device belongs to the user
	var device models.Device
	if err := r.db.Where("id = ? AND user_email = ?", deviceID, userEmail).First(&device).Error; err != nil {
		return err
	}

	// Delete the device
	return r.db.Delete(&device).Error
}

// UpdateDeviceName updates a device's name
func (r *Repository) UpdateDeviceName(deviceID string, userEmail string, newName string) error {
	// Verify the device belongs to the user
	var device models.Device
	if err := r.db.Where("id = ? AND user_email = ?", deviceID, userEmail).First(&device).Error; err != nil {
		return err
	}

	// Update the device name
	device.DeviceName = newName
	return r.db.Save(&device).Error
}
