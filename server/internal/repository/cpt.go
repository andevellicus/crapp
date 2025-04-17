// internal/repository/cognitive_tests.go
package repository

import (
	"fmt"
	"strings"

	"github.com/andevellicus/crapp/internal/models"
	"github.com/andevellicus/crapp/internal/utils"
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

	if err := r.db.Create(results).Error; err != nil {
		r.log.Errorw("Error saving CPT result", "error", err)
		return fmt.Errorf("failed to save CPT result: %w", err)
	}

	// Return the ID of the newly created result
	return nil
}

// GetCPTTimelineData retrieves CPT metrics in timeline format
func (r *CognitiveTestRepository) GetCPTTimelineData(email, metricKey string) ([]TimelineDataPoint, error) {
	var results []models.CPTResult

	normalizedEmail := strings.ToLower(email)
	// Query the database for CPT results for the user, ordered by date
	err := r.db.Where("LOWER(user_email) = ?", normalizedEmail).
		Order("created_at ASC").
		Find(&results).Error

	if err != nil {
		r.log.Errorw("Error retrieving CPT timeline data", "error", err)
		return nil, err
	}

	// For each result, check if the raw data is compressed and decompress if needed
	for i := range results {
		if len(results[i].RawData) > 0 {
			// Check if data is compressed (assuming you're using the GZIP header approach)
			if len(results[i].RawData) >= 4 && string(results[i].RawData[0:4]) == "GZIP" {
				decompressed, err := utils.DecompressData(results[i].RawData)
				if err != nil {
					r.log.Warnw("Failed to decompress CPT raw data", "error", err)
				} else {
					results[i].RawData = decompressed
				}
			}
		}
	}

	// Convert to timeline data points
	timelinePoints := make([]TimelineDataPoint, len(results))
	for i, result := range results {
		// Initialize with common date
		timelinePoints[i] = TimelineDataPoint{
			Date: result.CreatedAt,
		}

		// Set the appropriate metric value based on the metric key
		switch metricKey {
		case "reaction_time":
			timelinePoints[i].MetricValue = result.AverageReactionTime
			// Use a constant value or 0 for the symptom since there's no direct symptom correlation
			timelinePoints[i].SymptomValue = 0
		case "detection_rate":
			timelinePoints[i].MetricValue = result.DetectionRate
			timelinePoints[i].SymptomValue = 0
		case "omission_error_rate":
			timelinePoints[i].MetricValue = result.OmissionErrorRate
			timelinePoints[i].SymptomValue = 0
		case "commission_error_rate":
			timelinePoints[i].MetricValue = result.CommissionErrorRate
			timelinePoints[i].SymptomValue = 0
		}
	}

	return timelinePoints, nil
}
