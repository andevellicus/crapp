// internal/repository/cognitive_tests.go
package repository

import (
	"fmt"
	"time"

	"github.com/andevellicus/crapp/internal/models"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// CognitiveTestRepository handles storage of cognitive test results
type CognitiveTestRepository struct {
	db  *gorm.DB
	log *zap.SugaredLogger
}

// NewCognitiveTestRepository creates a new repository for cognitive tests
func NewCognitiveTestRepository(db *gorm.DB, log *zap.SugaredLogger) *CognitiveTestRepository {
	return &CognitiveTestRepository{
		db:  db,
		log: log.Named("cog-test-repo"),
	}
}

// SaveCPTResults saves CPT test results to database
func (r *CognitiveTestRepository) Create(results *models.CPTResult) error {
	// Save to database
	if err := r.db.Create(&results).Error; err != nil {
		r.log.Errorw("Error saving CPT result", "error", err)
		return fmt.Errorf("failed to save CPT result: %w", err)
	}

	return nil
}

// GetCPTResults retrieves CPT results for a user
func (r *CognitiveTestRepository) GetCPTResults(userEmail string, limit int) (*[]models.CPTResult, error) {
	var results []models.CPTResult

	query := r.db.Where("user_email = ?", userEmail).
		Order("test_start_time DESC").
		Limit(limit)

	if err := query.Find(&results).Error; err != nil {
		r.log.Errorw("Error retrieving CPT results", "error", err, "userEmail", userEmail)
		return nil, fmt.Errorf("failed to retrieve CPT results: %w", err)
	}

	return &results, nil
}

// GetCPTResultsByAssessment retrieves CPT results linked to an assessment
func (r *CognitiveTestRepository) GetCPTResultsByAssessment(assessmentID uint) (*models.CPTResult, error) {
	var result models.CPTResult

	if err := r.db.Where("assessment_id = ?", assessmentID).First(&result).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		r.log.Errorw("Error retrieving CPT result by assessment", "error", err, "assessmentID", assessmentID)
		return nil, fmt.Errorf("failed to retrieve CPT result: %w", err)
	}

	return &result, nil
}

// GetCPTResultByID retrieves a single CPT result by ID
func (r *CognitiveTestRepository) GetCPTResultByID(id uint) (*models.CPTResult, error) {
	var result models.CPTResult

	if err := r.db.First(&result, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		r.log.Errorw("Error retrieving CPT result", "error", err, "id", id)
		return nil, fmt.Errorf("failed to retrieve CPT result: %w", err)
	}

	return &result, nil
}

// GetCPTMetrics gets aggregated metrics for a user
func (r *CognitiveTestRepository) GetCPTMetrics(userEmail string, lastDays int) (map[string]float64, error) {
	var results []models.CPTResult

	query := r.db.Where("user_email = ?", userEmail)

	// Filter by date if specified
	if lastDays > 0 {
		cutoffDate := time.Now().AddDate(0, 0, -lastDays)
		query = query.Where("test_start_time >= ?", cutoffDate)
	}

	if err := query.Find(&results).Error; err != nil {
		r.log.Errorw("Error retrieving CPT metrics", "error", err)
		return nil, fmt.Errorf("failed to retrieve CPT metrics: %w", err)
	}

	// Calculate aggregate metrics
	metrics := make(map[string]float64)
	if len(results) == 0 {
		return metrics, nil
	}

	// Sum up metrics
	var totalReactionTime, totalDetectionRate, totalOmissionRate, totalCommissionRate float64
	for _, result := range results {
		totalReactionTime += result.AverageReactionTime
		totalDetectionRate += result.DetectionRate
		totalOmissionRate += result.OmissionErrorRate
		totalCommissionRate += result.CommissionErrorRate
	}

	// Calculate averages
	count := float64(len(results))
	metrics["avg_reaction_time"] = totalReactionTime / count
	metrics["avg_detection_rate"] = totalDetectionRate / count
	metrics["avg_omission_rate"] = totalOmissionRate / count
	metrics["avg_commission_rate"] = totalCommissionRate / count
	metrics["test_count"] = count

	return metrics, nil
}
