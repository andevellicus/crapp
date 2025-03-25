package repository

import (
	"encoding/json"
	"errors"
	"time"

	"github.com/andevellicus/crapp/internal/models"
	"gorm.io/gorm"
)

// Repository handles all database operations
type Repository struct {
	db *gorm.DB
}

// NewRepository creates a new repository with the given database connection
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// GetUser retrieves a user by ID
func (r *Repository) GetUser(userID string) (*models.User, error) {
	var user models.User
	result := r.db.First(&user, "id = ?", userID)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, nil // User not found
		}
		return nil, result.Error
	}
	return &user, nil
}

// CreateUser creates a new user
func (r *Repository) CreateUser(userID string) (*models.User, error) {
	user := models.User{
		ID:        userID,
		CreatedAt: time.Now(),
	}

	result := r.db.Create(&user)
	if result.Error != nil {
		return nil, result.Error
	}

	return &user, nil
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

// CreateAssessment creates a new assessment from submission data
func (r *Repository) CreateAssessment(assessment *models.AssessmentSubmission) (uint, error) {
	// Check if user exists, create if not
	user, err := r.GetUser(assessment.UserID)
	if err != nil {
		return 0, err
	}

	if user == nil {
		user, err = r.CreateUser(assessment.UserID)
		if err != nil {
			return 0, err
		}
	}

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
		UserID:              assessment.UserID,
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

	result := r.db.Create(&newAssessment)
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
