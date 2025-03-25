package main

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/andevellicus/crapp/internal/handlers"
	"github.com/andevellicus/crapp/internal/logger"
	"github.com/andevellicus/crapp/internal/middleware"
	"github.com/andevellicus/crapp/internal/models"
	"github.com/andevellicus/crapp/internal/repository"
	"github.com/andevellicus/crapp/internal/utils"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

func main() {
	// Create logs directory if it doesn't exist
	logsDir := "logs"
	if err := os.MkdirAll(logsDir, 0755); err != nil {
		panic(fmt.Sprintf("Failed to create logs directory: %v", err))
	}

	// Create log filename with current timestamp
	timestamp := time.Now().Format("2006-01-02_15-04-05")
	logFile := filepath.Join(logsDir, fmt.Sprintf("crapp_%s.log", timestamp))

	// Initialize Zap logger
	err := logger.InitLogger(logFile, false)
	if err != nil {
		panic("Failed to initialize logger: " + err.Error())
	}
	defer logger.Sync()

	log := logger.Sugar
	log.Info("Starting CRAPP server with Gin")

	// Set Gin mode based on environment
	if os.Getenv("GIN_MODE") == "release" {
		gin.SetMode(gin.ReleaseMode)
	} else {
		gin.SetMode(gin.DebugMode)
	}

	// Initialize YAML question loader
	questionLoader, err := utils.NewQuestionLoader("questions.yaml")
	if err != nil {
		log.Fatalf("Failed to load questions: %v", err)
	}

	// Setup database
	db, err := setupDatabase()
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Create repository
	repo := repository.NewRepository(db, log)

	// Initialize handlers
	apiHandler := handlers.NewGinAPIHandler(repo, questionLoader, log)
	viewHandler := handlers.NewGinViewHandler("static")

	// Create Gin router
	router := gin.New()

	// Apply middleware
	router.Use(gin.Recovery())
	router.Use(middleware.GinLogger(log))

	// Static files
	router.Static("/static", "./static")

	// View routes
	router.GET("/", viewHandler.ServeIndex)
	router.GET("/visualize", viewHandler.ServeVisualize)

	// API routes
	api := router.Group("/api")
	{
		api.GET("/questions", apiHandler.GetQuestions)
		api.GET("/questions/symptoms", apiHandler.GetSymptomQuestions)
		api.POST("/submit", apiHandler.SubmitAssessment)
		api.GET("/assessments/:user_id", apiHandler.GetUserAssessments)
	}

	// Start server
	addr := "0.0.0.0:5000"
	log.Infof("Starting server on %s", addr)
	if err := router.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

// setupDatabase initializes the database connection
func setupDatabase() (*gorm.DB, error) {
	// Get database URL from environment variable or use default SQLite database
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "crapp.db"
	}

	// Get a logger for GORM
	dbLogger := logger.GetLogger("gorm")

	// Configure GORM logger
	gormConfig := &gorm.Config{
		Logger: gormlogger.New(
			&GormLogAdapter{zapLogger: dbLogger},
			gormlogger.Config{
				SlowThreshold:             time.Second,
				LogLevel:                  gormlogger.Error,
				IgnoreRecordNotFoundError: true,
				Colorful:                  false,
			},
		),
	}

	// Connect to database
	db, err := gorm.Open(sqlite.Open(dbURL), gormConfig)
	if err != nil {
		return nil, err
	}

	// Migrate database schema
	err = db.AutoMigrate(&models.User{}, &models.Assessment{})
	if err != nil {
		return nil, err
	}

	return db, nil
}

// GormLogAdapter adapts zap logger to gorm logger interface
type GormLogAdapter struct {
	zapLogger *zap.Logger
}

// Printf implements GORM's logger interface
func (l *GormLogAdapter) Printf(format string, args ...interface{}) {
	l.zapLogger.Sugar().Infof(format, args...)
}
