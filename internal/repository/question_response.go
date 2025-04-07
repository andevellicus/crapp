// Add this file as internal/repository/question_response.go

package repository

import (
	"github.com/andevellicus/crapp/internal/models"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// QuestionResponseRepository handles persistence of question responses
type QuestionResponseRepository struct {
	db  *gorm.DB
	log *zap.SugaredLogger
}

// NewQuestionResponseRepository creates a new repository for question responses
func NewQuestionResponseRepository(db *gorm.DB, log *zap.SugaredLogger) *QuestionResponseRepository {
	return &QuestionResponseRepository{
		db:  db,
		log: log.Named("question-resp-repo"),
	}
}

// SaveBatch saves multiple question responses in a single operation
func (r *QuestionResponseRepository) SaveBatch(responses []models.QuestionResponse) error {
	if len(responses) == 0 {
		return nil
	}

	// Use CreateInBatches for better performance with large numbers of responses
	result := r.db.CreateInBatches(&responses, 100)
	if result.Error != nil {
		r.log.Errorw("Failed to save question responses batch",
			"error", result.Error,
			"count", len(responses))
		return result.Error
	}

	r.log.Infow("Saved question responses batch",
		"count", len(responses),
		"records_affected", result.RowsAffected)
	return nil
}

// GetByAssessment retrieves all question responses for a given assessment
func (r *QuestionResponseRepository) GetByAssessment(assessmentID uint) ([]models.QuestionResponse, error) {
	var responses []models.QuestionResponse
	if err := r.db.Where("assessment_id = ?", assessmentID).Find(&responses).Error; err != nil {
		r.log.Errorw("Error retrieving question responses",
			"error", err,
			"assessment_id", assessmentID)
		return nil, err
	}
	return responses, nil
}

// GetByQuestionAndUser gets all responses to a specific question by a user
func (r *QuestionResponseRepository) GetByQuestionAndUser(questionID, userEmail string) ([]models.QuestionResponse, error) {
	var responses []models.QuestionResponse

	// Join with assessment table to filter by user email
	err := r.db.Joins("JOIN assessments ON question_responses.assessment_id = assessments.id").
		Where("question_responses.question_id = ? AND assessments.user_email = ?",
			questionID, userEmail).
		Find(&responses).Error

	if err != nil {
		r.log.Errorw("Error retrieving question responses",
			"error", err,
			"question_id", questionID,
			"user_email", userEmail)
		return nil, err
	}

	return responses, nil
}
