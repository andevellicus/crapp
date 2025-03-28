package repository

import (
	"github.com/andevellicus/crapp/internal/config"
	"github.com/andevellicus/crapp/internal/logger"
	"github.com/andevellicus/crapp/internal/models"
	"go.uber.org/zap"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// Repository handles all database operations
type Repository struct {
	db  *gorm.DB
	log *zap.SugaredLogger
}

// NewRepository creates a new repository with the given database connection
func NewRepository(cfg *config.Config, log *zap.SugaredLogger) *Repository {
	// Setup database
	db, err := setupDatabase(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	return &Repository{
		db:  db,
		log: log.Named("repository"),
	}
}

// setupDatabase initializes the database connection
func setupDatabase(cfg *config.Config) (*gorm.DB, error) {
	// Get database configuration
	dbURL := cfg.Database.URL

	// Get a logger for GORM
	dbLogger := logger.GetLogger("gorm")

	// Configure GORM logger
	gormConfig := logger.SetUpGormConfig(dbLogger, cfg.Logging.Level)

	// Connect to database
	db, err := gorm.Open(sqlite.Open(dbURL), gormConfig)
	if err != nil {
		return nil, err
	}

	// Migrate database schema
	// Add FormState to the list of models
	err = db.AutoMigrate(&models.User{}, &models.Assessment{}, &models.FormState{}, &models.AssessmentMetric{})
	if err != nil {
		return nil, err
	}

	return db, nil
}
