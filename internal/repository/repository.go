package repository

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"strconv"
	"strings"
	"time"

	"github.com/andevellicus/crapp/internal/models"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// TimelineDataPoint represents a single point in a metrics timeline
type TimelineDataPoint struct {
	Date         time.Time `json:"date"`
	SymptomValue float64   `json:"symptom_value"`
	MetricValue  float64   `json:"metric_value"`
}

// CorrelationDataPoint represents a single point for correlation analysis
type CorrelationDataPoint struct {
	SymptomValue float64 `json:"symptom_value"`
	MetricValue  float64 `json:"metric_value"`
}

// MetricsData contains pre-processed metrics data for visualization
type MetricsData struct {
	SymptomName  string                 `json:"symptom_name"`
	MetricName   string                 `json:"metric_name"`
	Timeline     []TimelineDataPoint    `json:"timeline"`
	Correlation  []CorrelationDataPoint `json:"correlation"`
	SymptomScale map[string]interface{} `json:"symptom_scale"`
	MetricMinMax map[string]float64     `json:"metric_min_max"`
}

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

	// Create assessment record with empty metrics
	newAssessment := models.Assessment{
		UserEmail:       assessment.UserEmail,
		DeviceID:        assessment.DeviceID,
		Date:            time.Now(),
		SubmittedAt:     time.Now(),
		Responses:       assessment.Responses,
		Metrics:         models.JSON{}, // Initialize empty
		QuestionMetrics: models.JSON{}, // Initialize empty
	}

	// Process metadata if available
	if assessment.Metadata != nil {
		var metadata map[string]interface{}
		if err := json.Unmarshal(assessment.Metadata, &metadata); err != nil {
			r.log.Warnw("Invalid metadata JSON", "error", err)
		} else {
			// Store global metrics
			if metrics, ok := metadata["interaction_metrics"].(map[string]interface{}); ok {
				newAssessment.Metrics = models.JSON(metrics)
			}

			// Store question-specific metrics
			if questionMetrics, ok := metadata["question_metrics"].(map[string]interface{}); ok {
				newAssessment.QuestionMetrics = models.JSON(questionMetrics)
			}
		}
	}

	// Convert the original submission to raw data for auditing/debugging
	rawDataBytes, err := json.Marshal(assessment)
	if err == nil {
		var rawData models.JSON
		_ = json.Unmarshal(rawDataBytes, &rawData)
		newAssessment.RawData = rawData
	}

	// Save to database
	result = r.db.Create(&newAssessment)
	if result.Error != nil {
		return 0, result.Error
	}

	r.log.Infow("Assessment created successfully",
		"id", newAssessment.ID,
		"user", assessment.UserEmail,
		"device", assessment.DeviceID,
		"responses_count", len(assessment.Responses),
		"has_metrics", len(newAssessment.Metrics) > 0,
		"has_question_metrics", len(newAssessment.QuestionMetrics) > 0)

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

	query := r.db.Where("user_email = ?", userID).
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

		// Extract metrics from the Metrics JSON field
		if len(assessment.Metrics) > 0 {
			// Copy all metrics to the InteractionMetrics struct
			metricsData := assessment.Metrics

			// Check for specific metrics and assign them
			if clickPrecision, ok := getFloat64FromJSON(metricsData, "clickPrecision"); ok {
				summary.InteractionMetrics.ClickPrecision = clickPrecision
			}
			if pathEfficiency, ok := getFloat64FromJSON(metricsData, "pathEfficiency"); ok {
				summary.InteractionMetrics.PathEfficiency = pathEfficiency
			}
			if overShootRate, ok := getFloat64FromJSON(metricsData, "overShootRate"); ok {
				summary.InteractionMetrics.OvershootRate = overShootRate
			}
			if avgVelocity, ok := getFloat64FromJSON(metricsData, "averageVelocity"); ok {
				summary.InteractionMetrics.AverageVelocity = avgVelocity
			}
			if velVariability, ok := getFloat64FromJSON(metricsData, "velocityVariability"); ok {
				summary.InteractionMetrics.VelocityVariability = velVariability
			}
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

// SearchUsers searches for users by email or name
func (r *Repository) SearchUsers(query string, skip, limit int) ([]models.User, int64, error) {
	var users []models.User
	var total int64

	db := r.db

	if query != "" {
		query = "%" + query + "%"
		db = db.Where("email LIKE ? OR first_name LIKE ? OR last_name LIKE ?", query, query, query)
	}

	if err := db.Model(&models.User{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	result := db.Order("email").Offset(skip).Limit(limit).Find(&users)
	if result.Error != nil {
		return nil, 0, result.Error
	}

	// Don't return password hashes
	for i := range users {
		users[i].Password = nil
	}

	return users, total, nil
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
		const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
		b := make([]byte, 16)
		for i := range b {
			b[i] = charset[rand.Int63()%int64(len(charset))]
		}
		deviceID = string(b)
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

// GetMetricsCorrelation gets correlation data for a specific symptom and metric
func (r *Repository) GetMetricsCorrelation(userID, symptomKey, metricKey string) ([]CorrelationDataPoint, error) {
	var assessments []models.Assessment
	var result []CorrelationDataPoint

	// Query database for assessments with these keys
	query := r.db.Where("user_email = ?", userID).Order("date DESC")

	if err := query.Find(&assessments).Error; err != nil {
		return nil, fmt.Errorf("database error: %w", err)
	}

	// Process into correlation format
	for _, assessment := range assessments {
		// Extract symptom value
		symptomValue, err1 := getSymptomValue(&assessment, symptomKey)
		// Extract metric value
		metricValue, err2 := getMetricValue(&assessment, metricKey, symptomKey)

		if err1 == nil && err2 == nil && symptomValue != nil && metricValue != nil {
			// Add to result set
			result = append(result, CorrelationDataPoint{
				SymptomValue: *symptomValue,
				MetricValue:  *metricValue,
			})
		}
	}

	// Log the results
	r.log.Infow("Generated correlation data",
		"user_id", userID,
		"symptom", symptomKey,
		"metric", metricKey,
		"points_count", len(result),
		"result", result)

	return result, nil
}

// GetMetricsTimeline gets timeline data for a specific symptom and metric
func (r *Repository) GetMetricsTimeline(userID, symptomKey, metricKey string) ([]TimelineDataPoint, error) {
	var assessments []models.Assessment
	var result []TimelineDataPoint

	// Query database for assessments with these keys
	query := r.db.Where("user_email = ?", userID).Order("date ASC")

	if err := query.Find(&assessments).Error; err != nil {
		return nil, fmt.Errorf("database error: %w", err)
	}

	// Process into timeline format
	for _, assessment := range assessments {
		// Extract symptom value
		symptomValue, err1 := getSymptomValue(&assessment, symptomKey)
		// Extract metric value
		metricValue, err2 := getMetricValue(&assessment, metricKey, symptomKey)

		if err1 == nil && err2 == nil && symptomValue != nil && metricValue != nil {
			result = append(result, TimelineDataPoint{
				Date:         assessment.Date,
				SymptomValue: *symptomValue,
				MetricValue:  *metricValue,
			})
		}
	}

	r.log.Infow("Generated timeline data",
		"user_id", userID,
		"symptom", symptomKey,
		"metric", metricKey,
		"points_count", len(result))

	return result, nil
}

// GetMetricsData gets all visualization data in one call
func (r *Repository) GetMetricsData(userID, symptomKey, metricKey string) (*MetricsData, error) {
	// Get correlation data
	correlation, err := r.GetMetricsCorrelation(userID, symptomKey, metricKey)
	if err != nil {
		return nil, err
	}

	// Get timeline data
	timeline, err := r.GetMetricsTimeline(userID, symptomKey, metricKey)
	if err != nil {
		return nil, err
	}

	// Load question info to get scale
	// This would require accessing the QuestionLoader
	// For now, use a default scale
	symptomScale := map[string]interface{}{
		"min":  0,
		"max":  3,
		"step": 1,
	}

	// Calculate metric min/max for proper scaling
	metricMin, metricMax := 0.0, 0.0
	if len(correlation) > 0 {
		metricMin = correlation[0].MetricValue
		metricMax = correlation[0].MetricValue

		for _, point := range correlation {
			if point.MetricValue < metricMin {
				metricMin = point.MetricValue
			}
			if point.MetricValue > metricMax {
				metricMax = point.MetricValue
			}
		}
	}

	return &MetricsData{
		SymptomName:  symptomKey,
		MetricName:   metricKey,
		Timeline:     timeline,
		Correlation:  correlation,
		SymptomScale: symptomScale,
		MetricMinMax: map[string]float64{
			"min": metricMin,
			"max": metricMax,
		},
	}, nil
}

// CreateFormState creates a new form session for a user
func (r *Repository) CreateFormState(userEmail string, questionOrder []int) (*models.FormState, error) {
	questionOrderBytes, _ := json.Marshal(questionOrder)
	formState := &models.FormState{
		ID:            uuid.New().String(),
		UserEmail:     userEmail,
		CurrentStep:   0,
		Answers:       models.JSON{}, // Use the custom type
		QuestionOrder: string(questionOrderBytes),
		StartedAt:     time.Now(),
		LastUpdatedAt: time.Now(),
		Completed:     false,
	}

	err := r.db.Create(formState).Error
	if err != nil {
		return nil, err
	}

	return formState, nil
}

// GetFormState retrieves a user's current form state
func (r *Repository) GetFormState(stateID string) (*models.FormState, error) {
	var formState models.FormState

	err := r.db.Where("id = ?", stateID).First(&formState).Error
	if err != nil {
		return nil, err
	}

	return &formState, nil
}

// UpdateFormState updates a user's form state
func (r *Repository) UpdateFormState(formState *models.FormState) error {
	formState.LastUpdatedAt = time.Now()

	return r.db.Save(formState).Error
}

// SaveFormAnswer saves an answer for a specific question
func (r *Repository) SaveFormAnswer(stateID string, questionID string, answer interface{}) error {
	var formState models.FormState

	err := r.db.Where("id = ?", stateID).First(&formState).Error
	if err != nil {
		return err
	}

	formState.Answers[questionID] = answer
	formState.LastUpdatedAt = time.Now()

	return r.db.Save(&formState).Error
}

// GetUserActiveFormState gets a user's most recent active form state
func (r *Repository) GetUserActiveFormState(userEmail string) (*models.FormState, error) {
	var formState models.FormState

	err := r.db.Where("user_email = ? AND completed = ?", userEmail, false).
		Order("last_updated_at DESC").
		First(&formState).Error

	if err != nil {
		return nil, err
	}

	return &formState, nil
}

// getSymptomValue extracts a symptom value from an assessment
func getSymptomValue(assessment *models.Assessment, symptomKey string) (*float64, error) {
	// Try to get from responses object (new format)
	if assessment.Responses != nil {
		if val, ok := assessment.Responses[symptomKey]; ok {
			// Handle different value types (could be string, number, etc.)
			switch v := val.(type) {
			case float64:
				return &v, nil
			case int:
				f := float64(v)
				return &f, nil
			case string:
				if f, err := strconv.ParseFloat(v, 64); err == nil {
					return &f, nil
				}
			}
		}
	}

	// Try legacy format (if symptom data is structured differently)
	if rawData, ok := assessment.RawData["responses"].(map[string]interface{}); ok {
		if val, ok := rawData[symptomKey]; ok {
			// Handle different value types
			switch v := val.(type) {
			case float64:
				return &v, nil
			case int:
				f := float64(v)
				return &f, nil
			case string:
				if f, err := strconv.ParseFloat(v, 64); err == nil {
					return &f, nil
				}
			}
		}
	}

	return nil, fmt.Errorf("symptom value not found for key: %s", symptomKey)
}

func getMetricValue(assessment *models.Assessment, metricKey, symptomKey string) (*float64, error) {
	// Convert metric key to camelCase for alternate format checking
	camelCaseKey := toCamelCase(metricKey)

	// Define locations to check with ordered priority
	sources := []struct {
		name      string
		container map[string]interface{}
	}{
		// Try question-specific metrics first
		{"questionMetrics", getNestedMap(assessment.QuestionMetrics, symptomKey)},

		// Then try metrics field for any value
		{"metrics", assessment.Metrics},

		// Then try raw data fields
		{"rawQuestionMetrics", getNestedMap(
			getNestedMap(getNestedMap(assessment.RawData, "metadata"), "question_metrics"),
			symptomKey),
		},
		{"rawInteractionMetrics", getNestedMap(
			getNestedMap(assessment.RawData, "metadata"),
			"interaction_metrics"),
		},
	}

	// Check each location for both key variants
	for _, source := range sources {
		if source.container != nil {
			// Check original key
			if val, ok := source.container[metricKey]; ok {
				return extractFloat64Value(val)
			}

			// Check camelCase variant
			if val, ok := source.container[camelCaseKey]; ok {
				return extractFloat64Value(val)
			}
		}
	}

	return nil, fmt.Errorf("metric value not found for key: %s in question: %s", metricKey, symptomKey)
}

// Helper function to safely navigate nested maps
func getNestedMap(data interface{}, key string) map[string]interface{} {
	if data == nil {
		return nil
	}

	// Try to cast data to map
	dataMap, ok := data.(map[string]interface{})
	if !ok {
		return nil
	}

	// Try to get value at key
	value, ok := dataMap[key]
	if !ok {
		return nil
	}

	// Try to cast value to map
	valueMap, ok := value.(map[string]interface{})
	if !ok {
		return nil
	}

	return valueMap
}

// Helper to extract float64 from different value types
func extractFloat64Value(val interface{}) (*float64, error) {
	switch v := val.(type) {
	case float64:
		return &v, nil
	case int:
		f := float64(v)
		return &f, nil
	case map[string]interface{}:
		// Handle the case where metric value is an object with "value" field (common pattern)
		if value, ok := v["value"].(float64); ok {
			return &value, nil
		}
	case string:
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			return &f, nil
		}
	}
	return nil, fmt.Errorf("couldn't convert value to float64")
}

// Helper function to extract float64 values from JSON
func getFloat64FromJSON(data models.JSON, key string) (*float64, bool) {
	if val, ok := data[key]; ok {
		switch v := val.(type) {
		case float64:
			return &v, true
		case int:
			f := float64(v)
			return &f, true
		case map[string]interface{}:
			// Check if it's in the format with "value" field
			if valueField, ok := v["value"].(float64); ok {
				return &valueField, true
			}
		}
	}
	return nil, false
}

// Helper function to convert snake_case to camelCase
func toCamelCase(s string) string {
	parts := strings.Split(s, "_")
	for i := 1; i < len(parts); i++ {
		if len(parts[i]) > 0 {
			parts[i] = strings.ToUpper(parts[i][:1]) + parts[i][1:]
		}
	}
	return strings.Join(parts, "")
}
