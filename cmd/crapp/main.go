package main

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/andevellicus/crapp/internal/handlers"
	"github.com/andevellicus/crapp/internal/logger"
	"github.com/andevellicus/crapp/internal/middleware"
	"github.com/andevellicus/crapp/internal/models"
	"github.com/andevellicus/crapp/internal/repository"
	"github.com/andevellicus/crapp/internal/utils"
	"github.com/gorilla/mux"
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

	// Initialize Zap logger with the timestamped file in logs directory
	err := logger.InitLogger(logFile, false)
	if err != nil {
		panic("Failed to initialize logger: " + err.Error())
	}
	defer logger.Sync()

	log := logger.Sugar
	log.Info("Starting CRAPP server")

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
	apiHandler := handlers.NewAPIHandler(repo, questionLoader, log)
	viewHandler := handlers.NewViewHandler("static")

	// Setup router
	router := mux.NewRouter()

	// API routes
	router.HandleFunc("/api/questions", apiHandler.GetQuestions).Methods("GET")
	router.HandleFunc("/api/questions/symptoms", apiHandler.GetSymptomQuestions).Methods("GET")
	router.HandleFunc("/api/submit", apiHandler.SubmitAssessment).Methods("POST")
	router.HandleFunc("/api/assessments/{user_id}", apiHandler.GetUserAssessments).Methods("GET")

	// View routes
	router.HandleFunc("/", viewHandler.ServeIndex).Methods("GET")
	router.HandleFunc("/visualize", viewHandler.ServeVisualize).Methods("GET")

	// Static files
	viewHandler.ServeStatic(router)

	// Apply middleware
	handler := middleware.Setup(router, log)

	// Create HTTP server
	srv := &http.Server{
		Handler:      handler,
		Addr:         "0.0.0.0:5000",
		WriteTimeout: 15 * time.Second,
		ReadTimeout:  15 * time.Second,
	}

	// Start server
	log.Infof("Starting server on %s", srv.Addr)
	log.Fatal(srv.ListenAndServe())
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
