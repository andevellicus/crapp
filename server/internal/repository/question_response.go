// Add this file as internal/repository/question_response.go

package repository

import (
	"fmt"
	"strings"

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

	// Use PostgreSQL's COPY command for bulk inserts (much faster than individual INSERTs)
	tx := r.db.Begin()

	// Create a temporary table with the same structure
	tx.Exec("CREATE TEMPORARY TABLE temp_question_responses (LIKE question_responses INCLUDING ALL)")

	// Prepare values for bulk insert
	valueStrings := make([]string, 0, len(responses))
	valueArgs := make([]any, 0, len(responses)*7)

	for i, response := range responses {
		valueStrings = append(valueStrings, fmt.Sprintf("($%d, $%d, $%d, $%d, $%d, $%d, $%d)",
			i*7+1, i*7+2, i*7+3, i*7+4, i*7+5, i*7+6, i*7+7))

		valueArgs = append(valueArgs, response.AssessmentID)
		valueArgs = append(valueArgs, response.QuestionID)
		valueArgs = append(valueArgs, response.ValueType)
		valueArgs = append(valueArgs, response.NumericValue)
		valueArgs = append(valueArgs, response.TextValue)
		valueArgs = append(valueArgs, response.CreatedAt)
		valueArgs = append(valueArgs, 0) // For ID which will be generated
	}

	stmt := fmt.Sprintf("INSERT INTO temp_question_responses (assessment_id, question_id, value_type, numeric_value, text_value, created_at, id) VALUES %s",
		strings.Join(valueStrings, ","))

	if err := tx.Exec(stmt, valueArgs...).Error; err != nil {
		tx.Rollback()
		return err
	}

	// Insert from temp table to real table (this will handle the serial ID correctly)
	if err := tx.Exec("INSERT INTO question_responses SELECT * FROM temp_question_responses").Error; err != nil {
		tx.Rollback()
		return err
	}

	return tx.Commit().Error
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
