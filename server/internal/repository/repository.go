package repository

import (
	"time"

	"github.com/andevellicus/crapp/internal/config"
	"github.com/andevellicus/crapp/internal/logger"
	"github.com/andevellicus/crapp/internal/models"
	"github.com/andevellicus/crapp/internal/utils"
	_ "github.com/lib/pq"
	"go.uber.org/zap"
	"gorm.io/driver/postgres"
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
	repo.Users = NewUserRepository(db, log, cfg)
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

	db, err := gorm.Open(postgres.Open(dbURL), gormConfig)
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

	// Add GIN index for JSONB fields
	db.Exec("CREATE INDEX IF NOT EXISTS idx_form_states_answers ON form_states USING GIN (answers)")

	// For text stored as JSON, we need to cast to jsonb first
	db.Exec("CREATE INDEX IF NOT EXISTS idx_user_notification_email ON users((notification_preferences->>'email_enabled')) WHERE notification_preferences IS NOT NULL")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_user_notification_push ON users((notification_preferences->>'push_enabled')) WHERE notification_preferences IS NOT NULL")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_user_notification_gin ON users USING GIN (notification_preferences) WHERE notification_preferences IS NOT NULL")

	// Add composite indexes for common query patterns
	db.Exec("CREATE INDEX IF NOT EXISTS idx_metrics_query ON assessment_metrics(assessment_id, question_id, metric_key)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_question_response_query ON question_responses(assessment_id, question_id, value_type)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_timeline_query ON assessments(user_email, submitted_at)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_active_form_states ON form_states(user_email) WHERE assessment_id IS NULL")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_active_assessments ON assessments(user_email, submitted_at DESC)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_users_lower_email ON users (LOWER(email));")

	// Standard indexes
	db.Exec("CREATE INDEX IF NOT EXISTS idx_assessments_user_email ON assessments(user_email)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_assessments_device_id ON assessments(device_id)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_assessments_submitted_at ON assessments(submitted_at)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_question_responses_assessment_id ON question_responses(assessment_id)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_question_responses_question_id ON question_responses(question_id)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_assessment_metrics_assessment_id ON assessment_metrics(assessment_id)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_assessment_metrics_metric_key ON assessment_metrics(metric_key)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_cpt_results_user_email ON cpt_results(user_email)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_cpt_results_created_at ON cpt_results(created_at)")

	// Set connection pool parameters
	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}

	// Set max open connections based on your expected load
	sqlDB.SetMaxOpenConns(50)
	// Set max idle connections to reduce connection churn
	sqlDB.SetMaxIdleConns(25)
	// Set connection max lifetime to clean up inactive connections
	sqlDB.SetConnMaxLifetime(30 * time.Minute)

	// Add pool stat logging
	go func() {
		ticker := time.NewTicker(10 * time.Minute)
		for range ticker.C {
			stats := sqlDB.Stats()
			dbLogger.Sugar().Infof("DB Pool stats: Open=%d, InUse=%d, Idle=%d, WaitCount=%d, WaitDuration=%v",
				stats.OpenConnections, stats.InUse, stats.Idle, stats.WaitCount, stats.WaitDuration)
		}
	}()

	dbLogger.Info("Database initialized")

	return db, nil
}

func (r *Repository) WithTransaction(fn func(tx *gorm.DB) error) error {
	tx := r.db.Begin()
	if tx.Error != nil {
		return tx.Error
	}

	if err := fn(tx); err != nil {
		tx.Rollback()
		return err
	}

	return tx.Commit().Error
}
