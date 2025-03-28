package repository

import (
	"encoding/json"
	"time"

	"github.com/andevellicus/crapp/internal/models"
	"github.com/google/uuid"
)

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
