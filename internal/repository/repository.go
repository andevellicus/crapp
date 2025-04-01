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

// Entity represents a database entity with an ID field
type Entity interface {
	GetID() any
}

// GenericRepository provides a base implementation of Repository
type BaseRepository[T Entity] struct {
	DB        *gorm.DB
	Log       *zap.SugaredLogger
	TableName string
}

// Repository handles all database operations
type Repository struct {
	db             *gorm.DB
	log            *zap.SugaredLogger
	questionLoader *utils.QuestionLoader

	// Add specialized repositories
	Users          *UserRepository
	Devices        *DeviceRepository
	Assessments    *AssessmentRepository
	FormStates     *FormStateRepository
	RefreshTokens  *RefreshTokenRepository
	PasswordTokens *PasswordTokenRepository
	RevokedTokens  *RevokedTokenRepository
}

// RepositoryOperator defines the standard CRUD operations
type RepositoryOperator[T Entity] interface {
	Create(entity *T) error
	GetByID(id any) (*T, error)
	GetAll(limit, offset int) ([]T, int64, error)
	Update(entity *T) error
	Delete(id any) error
	DeleteEntity(entity *T) error
}

// NewBaseRepository creates a new generic repository
func NewBaseRepository[T Entity](db *gorm.DB, log *zap.SugaredLogger, tableName string) *BaseRepository[T] {
	return &BaseRepository[T]{
		DB:        db,
		Log:       log.Named(tableName),
		TableName: tableName,
	}
}

// NewRepository creates a new repository with the given database connection
func NewRepository(cfg *config.Config, log *zap.SugaredLogger, questionLoader *utils.QuestionLoader) *Repository {
	// Setup database
	db, err := setupDatabase(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	repo := &Repository{
		db:             db,
		log:            log.Named("repository"),
		questionLoader: questionLoader,
	}

	// Initialize specialized repositories
	repo.Users = NewUserRepository(db, log)
	repo.Devices = NewDeviceRepository(db, log)
	repo.Assessments = NewAssessmentRepository(db, log)
	repo.FormStates = NewFormStateRepository(db, log)
	repo.RefreshTokens = NewRefreshTokenRepository(db, log)
	repo.PasswordTokens = NewPasswordTokenRepository(db, log)
	repo.RevokedTokens = NewRevokedTokenRepository(db, log)

	return repo
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
		&models.PasswordResetToken{})
	if err != nil {
		return nil, err
	}

	return db, nil
}

// Create adds a new entity to the database
func (r *BaseRepository[T]) Create(entity *T) error {
	result := r.DB.Create(entity)
	if result.Error != nil {
		r.Log.Errorw("Failed to create entity", "error", result.Error)
		return result.Error
	}
	return nil
}

// GetByID retrieves an entity by its ID
func (r *BaseRepository[T]) GetByID(id any) (*T, error) {
	var entity T
	result := r.DB.Where("id = ?", id).First(&entity)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			return nil, nil // Return nil, nil when not found
		}
		r.Log.Errorw("Failed to get entity by ID", "id", id, "error", result.Error)
		return nil, result.Error
	}
	return &entity, nil
}

// GetAll retrieves all entities with pagination
func (r *BaseRepository[T]) GetAll(limit, offset int) ([]T, int64, error) {
	var entities []T
	var total int64

	// Get total count
	if err := r.DB.Model(new(T)).Count(&total).Error; err != nil {
		r.Log.Errorw("Failed to count entities", "error", err)
		return nil, 0, err
	}

	// Apply pagination
	result := r.DB.Limit(limit).Offset(offset).Find(&entities)
	if result.Error != nil {
		r.Log.Errorw("Failed to get entities", "error", result.Error)
		return nil, 0, result.Error
	}

	return entities, total, nil
}

// Update updates an existing entity
func (r *BaseRepository[T]) Update(entity *T) error {
	result := r.DB.Save(entity)
	if result.Error != nil {
		r.Log.Errorw("Failed to update entity", "error", result.Error)
		return result.Error
	}
	return nil
}

// Delete removes an entity by ID
func (r *BaseRepository[T]) Delete(id any) error {
	var entity T
	result := r.DB.Delete(&entity, id)
	if result.Error != nil {
		r.Log.Errorw("Failed to delete entity", "id", id, "error", result.Error)
		return result.Error
	}
	return nil
}

// DeleteEntity removes an entity
func (r *BaseRepository[T]) DeleteEntity(entity *T) error {
	result := r.DB.Delete(entity)
	if result.Error != nil {
		r.Log.Errorw("Failed to delete entity", "error", result.Error)
		return result.Error
	}
	return nil
}
