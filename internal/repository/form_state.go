package repository

import (
	"encoding/json"
	"time"

	"github.com/andevellicus/crapp/internal/models"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// UserRepository extends the generic repository with user-specific methods
type FormStateRepository struct {
	Base *BaseRepository[models.FormState]
}

// NewAssessmentRepository creates a new user repository
func NewFormStateRepository(db *gorm.DB, log *zap.SugaredLogger) *FormStateRepository {
	return &FormStateRepository{
		Base: NewBaseRepository[models.FormState](db, log.Named("form"), "forms"),
	}
}

// CreateFormState creates a new form session for a user
func (r *FormStateRepository) Create(userEmail string, questionOrder []int) (*models.FormState, error) {
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

	err := r.Base.DB.Create(formState).Error
	if err != nil {
		return nil, err
	}

	return formState, nil
}

// UpdateFormState updates a user's form state
func (r *FormStateRepository) Update(formState *models.FormState) error {
	formState.LastUpdatedAt = time.Now()
	return r.Base.Update(formState)
}

// SaveFormAnswer saves an answer for a specific question
func (r *FormStateRepository) SaveFormAnswer(stateID string, questionID string, answer any) error {
	var formState models.FormState

	err := r.Base.DB.Where("id = ?", stateID).First(&formState).Error
	if err != nil {
		return err
	}

	formState.Answers[questionID] = answer
	formState.LastUpdatedAt = time.Now()

	return r.Base.DB.Save(&formState).Error
}

// GetUserActiveFormState gets a user's most recent active form state
func (r *FormStateRepository) GetUserActiveFormState(userEmail string) (*models.FormState, error) {
	var formState models.FormState

	err := r.Base.DB.Where("user_email = ? AND completed = ?", userEmail, false).
		Order("last_updated_at DESC").
		First(&formState).Error

	if err != nil {
		return nil, err
	}

	return &formState, nil
}
