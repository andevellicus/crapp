package repository

import (
	"github.com/andevellicus/crapp/internal/config"
	"github.com/andevellicus/crapp/internal/logger"
	"github.com/andevellicus/crapp/internal/models"
	"github.com/andevellicus/crapp/internal/utils"
	"go.uber.org/zap"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// Repository handles all database operations
type Repository struct {
	db  *gorm.DB
	log *zap.SugaredLogger

	// Add specialized repositories
	Users               *UserRepository
	Devices             *DeviceRepository
	Assessments         *AssessmentRepository
	FormStates          *FormStateRepository
	CPTResults          *CognitiveTestRepository
	TMTResults          *TMTRepository
	QuestionResponses   *QuestionResponseRepository
	RefreshTokens       *RefreshTokenRepository
	PasswordResetTokens *PasswordTokenRepository
	RevokedTokens       *RevokedTokenRepository
}

// NewRepository creates a new repository with the given database connection
func NewRepository(cfg *config.Config, log *zap.SugaredLogger, questionLoader *utils.QuestionLoader) *Repository {
	// Setup database
	db, err := setupDatabase(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	repo := &Repository{
		db:  db,
		log: log.Named("repository"),
	}

	// Initialize specialized repositories
	repo.Users = NewUserRepository(db, log)
	repo.Devices = NewDeviceRepository(db, log)
	repo.Assessments = NewAssessmentRepository(db, log, repo.Users)
	repo.QuestionResponses = NewQuestionResponseRepository(db, log)
	repo.CPTResults = NewCognitiveTestRepository(db, log)
	repo.TMTResults = NewTrailRepository(db, log)
	repo.FormStates = NewFormStateRepository(db, log)
	repo.RefreshTokens = NewRefreshTokenRepository(db, log)
	repo.PasswordResetTokens = NewPasswordTokenRepository(db, log, repo.Users)
	repo.RevokedTokens = NewRevokedTokenRepository(db, log)
	repo.RevokedTokens = NewRevokedTokenRepository(db, log)

	return repo
}

func (r *Repository) CreateInBatches(value any, batchSize int) error {
	// Create in batches
	if err := r.db.CreateInBatches(value, batchSize).Error; err != nil {
		return err
	}
	return nil
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
	err = db.AutoMigrate(
		&models.User{},
		&models.Assessment{},
		&models.FormState{},
		&models.AssessmentMetric{},
		&models.QuestionResponse{},
		&models.RefreshToken{},
		&models.RevokedToken{},
		&models.PasswordResetToken{},
		&models.CPTResult{},
		&models.TMTResult{},
	)
	if err != nil {
		return nil, err
	}

	return db, nil
}
