// server/internal/repository/digit_span.go
package repository

import (
	"fmt"
	"strings"

	"github.com/andevellicus/crapp/internal/models"
	"github.com/andevellicus/crapp/internal/utils"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// DigitSpanResultRepository handles database operations for DigitSpanResult
type DigitSpanResultRepository struct {
	db  *gorm.DB
	log *zap.SugaredLogger
}

// NewDigitSpanResultRepository creates a new repository for digit span results
func NewDigitSpanResultRepository(db *gorm.DB, log *zap.SugaredLogger) *DigitSpanResultRepository {
	return &DigitSpanResultRepository{
		db:  db,
		log: log.Named("digit-span-repo"),
	}
}

// Create saves a new DigitSpanResult record to the database.
func (r *DigitSpanResultRepository) Create(result *models.DigitSpanResult) error {
	// Basic validation
	if result.AssessmentID == 0 {
		return fmt.Errorf("assessment ID is required")
	}
	if result.UserEmail == "" {
		return fmt.Errorf("user email is required")
	}

	// Save to database
	if err := r.db.Create(result).Error; err != nil {
		r.log.Errorw("Error saving Digit Span result",
			"error", err,
			"assessment_id", result.AssessmentID,
			"user_email", result.UserEmail,
		)
		return fmt.Errorf("failed to save Digit Span result: %w", err)
	}

	r.log.Infow("Successfully saved Digit Span result",
		"result_id", result.ID,
		"assessment_id", result.AssessmentID,
	)
	return nil
}

// GetDigitSpanTimelineData retrieves Digit Span metrics for timeline view
func (r *DigitSpanResultRepository) GetDigitSpanTimelineData(email, metricKey string) ([]TimelineDataPoint, error) {
	var results []models.DigitSpanResult

	normalizedEmail := strings.ToLower(email)
	// Query the database for Trail Making Test results for the user, ordered by date
	err := r.db.Where("user_email = ?", normalizedEmail).
		Order("created_at ASC").
		Find(&results).Error

	if err != nil {
		r.log.Errorw("Error retrieving digit span test timeline data", "error", err)
		return nil, err
	}

	// For each result, check if the raw data is compressed and decompress if needed
	for i := range results {
		if len(results[i].RawData) > 0 {
			// Check if data is compressed (assuming you're using the GZIP header approach)
			if len(results[i].RawData) >= 4 && string(results[i].RawData[0:4]) == "GZIP" {
				decompressed, err := utils.DecompressData(results[i].RawData)
				if err != nil {
					r.log.Warnw("Failed to decompress TMT raw data", "error", err)
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

		// Determine which field to select based on metricKey
		switch metricKey {
		case "highest_span":
			timelinePoints[i].MetricValue = float64(result.HighestSpanAchieved)
			timelinePoints[i].SymptomValue = 0
		case "correct_trials":
			timelinePoints[i].MetricValue = float64(result.CorrectTrials)
			timelinePoints[i].SymptomValue = 0
		case "total_trials":
			timelinePoints[i].MetricValue = float64(result.TotalTrials)
			timelinePoints[i].SymptomValue = 0
		}
	}
	return timelinePoints, nil
}
