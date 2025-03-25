package main

import (
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/andevellicus/crapp/internal/handlers"
	"github.com/andevellicus/crapp/internal/models"
	"github.com/andevellicus/crapp/internal/repository"
	"github.com/andevellicus/crapp/internal/utils"
	"github.com/gorilla/mux"
	"github.com/rs/cors"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

func main() {
	// Setup logging
	var logWriter io.Writer = os.Stdout
	logFile, err := os.OpenFile("crapp.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err == nil {
		logWriter = io.MultiWriter(os.Stdout, logFile)
		defer logFile.Close()
	} else {
		log.Printf("Failed to open log file: %v", err)
	}
	fileLogger := log.New(logWriter, "[CRAPP] ", log.LstdFlags)

	// Initialize YAML question loader
	questionLoader, err := utils.NewQuestionLoader("questions.yaml")
	if err != nil {
		fileLogger.Fatalf("Failed to load questions: %v", err)
	}

	// Setup database
	db, err := setupDatabase(logWriter)
	if err != nil {
		fileLogger.Fatalf("Failed to connect to database: %v", err)
	}

	// Create repository
	repo := repository.NewRepository(db)

	// Initialize handlers
	apiHandler := handlers.NewAPIHandler(repo, questionLoader, fileLogger)
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

	// Setup CORS
	corsMiddleware := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
	})

	// Create HTTP server
	srv := &http.Server{
		Handler:      corsMiddleware.Handler(router),
		Addr:         "0.0.0.0:5000",
		WriteTimeout: 15 * time.Second,
		ReadTimeout:  15 * time.Second,
	}

	// Start server
	fileLogger.Printf("Starting server on %s", srv.Addr)
	fileLogger.Fatal(srv.ListenAndServe())
}

// setupDatabase initializes the database connection
func setupDatabase(logWriter io.Writer) (*gorm.DB, error) {
	// Get database URL from environment variable or use default SQLite database
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "crapp.db"
	}

	// Configure GORM logger
	gormConfig := &gorm.Config{
		Logger: gormlogger.New(
			log.New(logWriter, "[GORM] ", log.LstdFlags),
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
