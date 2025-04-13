package repository

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/andevellicus/crapp/internal/models"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type FormStateRepository struct {
	db  *gorm.DB
	log *zap.SugaredLogger
}

// NewFormStateRepository creates a new user repository
func NewFormStateRepository(db *gorm.DB, log *zap.SugaredLogger) *FormStateRepository {
	return &FormStateRepository{
		db:  db,
		log: log.Named("form-state-repo"),
	}
}

// CreateFormState creates a new form session for a user
func (r *FormStateRepository) Create(userEmail string, questionOrder []int) (*models.FormState, error) {
	questionOrderBytes, _ := json.Marshal(questionOrder)
	formState := &models.FormState{
		ID:            uuid.New().String(),
		UserEmail:     userEmail,
		CurrentStep:   0,
		Answers:       models.JSON{},
		QuestionOrder: string(questionOrderBytes),
		StartedAt:     time.Now(),
		LastUpdatedAt: time.Now(),
	}

	err := r.db.Create(formState).Error
	if err != nil {
		return nil, err
	}

	return formState, nil
}

func (r *FormStateRepository) GetByID(stateID string) (*models.FormState, error) {
	if stateID == "" {
		return nil, fmt.Errorf("stateID cannot be empty")
	}

	var formState models.FormState
	result := r.db.Where("id = ?", stateID).First(&formState)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			return nil, nil
		}
		r.log.Errorw("Database error getting form state by id", "id", stateID, "error", result.Error)
		return nil, result.Error
	}
	return &formState, nil

}

// UpdateFormState updates a user's form state
func (r *FormStateRepository) Update(formState *models.FormState) error {

	// Parse question order
	var questionOrder []int
	if err := json.Unmarshal([]byte(formState.QuestionOrder), &questionOrder); err != nil {
		r.log.Errorw("Failed to parse question order", "error", err, "id", formState.ID)
		return err
	}
	// State transition validation -- make sure that the form is not set as complete
	// somehow unless it's on the last step
	if formState.AssessmentID != nil && formState.CurrentStep < len(questionOrder) {
		return fmt.Errorf("cannot mark form as completed when questions remain")
	}

	// Always update the timestamp
	formState.LastUpdatedAt = time.Now()

	// Use selective field update to prevent overwriting certain fields
	result := r.db.Model(&models.FormState{}).
		Where("id = ? AND user_email = ?", formState.ID, formState.UserEmail).
		Updates(map[string]any{
			"current_step":     formState.CurrentStep,
			"answers":          formState.Answers,
			"interaction_data": formState.InteractionData,
			"cpt_data":         formState.CPTData,
			"tmt_data":         formState.TMTData,
			"last_updated_at":  formState.LastUpdatedAt,
			"assessment_id":    formState.AssessmentID,
		})

	if result.Error != nil {
		r.log.Errorw("Failed to update form state", "error", result.Error, "id", formState.ID)
		return fmt.Errorf("failed to update form state: %w", result.Error)
	}

	if result.RowsAffected == 0 {
		return fmt.Errorf("form state not found or does not belong to user")
	}

	return nil
}

func (r *FormStateRepository) Delete(id string) error {
	// Simple delete without transaction
	result := r.db.Delete(&models.FormState{}, "id = ?", id)
	if result.Error != nil {
		return fmt.Errorf("failed to delete form state: %w", result.Error)
	}
	return nil
}

// GetUserActiveFormState gets a user's most recent active form state
func (r *FormStateRepository) GetUserActiveFormState(userEmail string) (*models.FormState, error) {
	var formState models.FormState

	err := r.db.Where("user_email = ? AND assessment_id IS NULL", userEmail).
		Order("last_updated_at DESC").
		First(&formState).Error

	if err != nil {
		return nil, err
	}

	return &formState, nil
}
