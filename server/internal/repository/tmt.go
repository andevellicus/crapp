package repository

import (
	"fmt"
	"strings"

	"github.com/andevellicus/crapp/internal/models"
	"github.com/andevellicus/crapp/internal/utils"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// TrailRepository handles storage of Trail Making Test results
type TMTRepository struct {
	db  *gorm.DB
	log *zap.SugaredLogger
}

// NewTrailRepository creates a new repository for Trail Making Tests
func NewTrailRepository(db *gorm.DB, log *zap.SugaredLogger) *TMTRepository {
	return &TMTRepository{
		db:  db,
		log: log.Named("trail-repo"),
	}
}

// Create saves Trail Making Test results to database
func (r *TMTRepository) Create(results *models.TMTResult) error {
	// Save to database
	if err := r.db.Create(results).Error; err != nil {
		r.log.Errorw("Error saving Trail Making Test result", "error", err)
		return fmt.Errorf("failed to save Trail Making Test result: %w", err)
	}

	return nil
}

// GetTrailTimelineData retrieves Trail Making Test metrics in timeline format
func (r *TMTRepository) GetTMTTimelineData(email, metricKey string) ([]TimelineDataPoint, error) {
	var results []models.TMTResult

	normalizedEmail := strings.ToLower(email)
	// Query the database for CPT results for the user, ordered by date
	err := r.db.Where("LOWER(user_email) = ?", normalizedEmail).
		Order("created_at ASC").
		Find(&results).Error

	if err != nil {
		r.log.Errorw("Error retrieving Trail Making Test timeline data", "error", err)
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

		// Set the appropriate metric value based on the metric key
		switch metricKey {
		case "part_a_time":
			timelinePoints[i].MetricValue = result.PartACompletionTime
			timelinePoints[i].SymptomValue = 0
		// Continuing from the partial GetTrailTimelineData method:
		case "part_b_time":
			timelinePoints[i].MetricValue = result.PartBCompletionTime
			timelinePoints[i].SymptomValue = 0
		case "b_to_a_ratio":
			timelinePoints[i].MetricValue = result.BToARatio
			timelinePoints[i].SymptomValue = 0
		case "part_a_errors":
			timelinePoints[i].MetricValue = float64(result.PartAErrors)
			timelinePoints[i].SymptomValue = 0
		case "part_b_errors":
			timelinePoints[i].MetricValue = float64(result.PartBErrors)
			timelinePoints[i].SymptomValue = 0
		}
	}

	return timelinePoints, nil
}
