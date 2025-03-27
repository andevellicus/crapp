package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/andevellicus/crapp/internal/config"
	"github.com/andevellicus/crapp/internal/handlers"
	"github.com/andevellicus/crapp/internal/logger"
	"github.com/andevellicus/crapp/internal/middleware"
	"github.com/andevellicus/crapp/internal/models"
	"github.com/andevellicus/crapp/internal/repository"
	"github.com/andevellicus/crapp/internal/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func main() {
	// Parse command line flags
	configPath := flag.String("config", "", "Path to configuration file")
	flag.Parse()

	// Load configuration
	cfg, err := config.LoadConfig(*configPath)
	if err != nil {
		panic(fmt.Sprintf("Failed to load configuration: %v", err))
	}

	// Create logs directory if it doesn't exist
	if err := os.MkdirAll(cfg.Logging.Directory, 0755); err != nil {
		panic(fmt.Sprintf("Failed to create logs directory: %v", err))
	}

	// Get log file path
	logFile := cfg.GetLogFilePath()

	// Initialize Zap logger
	isDevelopment := cfg.IsDevelopment()
	if err := logger.InitLogger(logFile, isDevelopment); err != nil {
		panic("Failed to initialize logger: " + err.Error())
	}
	defer logger.Sync()

	log := logger.Sugar
	log.Infof("Starting %s server with Gin", cfg.App.Name)
	log.Infof("Environment: %s", cfg.App.Environment)

	// Set Gin mode based on environment
	if cfg.IsProduction() {
		gin.SetMode(gin.ReleaseMode)
	} else {
		gin.SetMode(gin.DebugMode)
	}

	// Initialize YAML question loader
	questionLoader, err := utils.NewQuestionLoader(cfg.App.QuestionsFile)
	if err != nil {
		log.Fatalf("Failed to load questions: %v", err)
	}

	// Setup database
	db, err := setupDatabase(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Create repository
	repo := repository.NewRepository(db, log)

	// Create Gin router
	router := gin.New()

	// Set the template engine
	router.SetHTMLTemplate(handlers.SetupTemplates())

	// Static files
	router.Static("/static", "./static")

	// Initialize handlers
	apiHandler := handlers.CreateAPIHandler(repo, questionLoader, log)
	viewHandler := handlers.CreateViewHandler("static")
	// Create auth handler
	authHandler := handlers.NewAuthHandler(repo, log)
	// Create form handler
	formHandler := handlers.NewFormHandler(questionLoader, log)
	// Create metrics handler
	metricsHandler := handlers.NewMetricsHandler(log)

	// Apply middleware
	router.Use(gin.Recovery())
	router.Use(middleware.GinLogger(log))

	// View routes
	//router.GET("/", middleware.AuthRedirectMiddleware(), viewHandler.ServeIndex)
	router.GET("/", middleware.AuthRedirectMiddleware(), formHandler.ServeForm)
	router.GET("/login", viewHandler.ServeLogin)
	router.GET("/register", viewHandler.ServeRegister)
	router.GET("/profile", middleware.AuthMiddleware(), viewHandler.ServeProfile)
	router.GET("/devices", middleware.AuthMiddleware(), viewHandler.ServeDevices)

	// Auth API routes
	auth := router.Group("/api/auth")
	{
		auth.POST("/register", authHandler.Register)
		auth.POST("/login", authHandler.Login)
		// Password reset endpoints could be added here
	}

	// Protected API routes
	api := router.Group("/api")
	api.Use(middleware.AuthMiddleware())
	{
		// User routes
		api.GET("/user", authHandler.GetCurrentUser)
		api.PUT("/user", authHandler.UpdateUser)

		// Device routes
		api.GET("/devices", authHandler.GetUserDevices)
		api.POST("/devices/register", authHandler.RegisterDevice)
		api.DELETE("/devices/:deviceId", authHandler.RemoveDevice)
		api.POST("/devices/:deviceId/rename", authHandler.RenameDevice)

		// Assessment routes
		api.GET("/questions", apiHandler.GetQuestions)
		api.GET("/questions/symptoms", apiHandler.GetSymptomQuestions)
		api.POST("/submit", apiHandler.SubmitAssessment)
		api.GET("/assessments", apiHandler.GetUserAssessments)

		api.POST("/process-metrics", metricsHandler.ProcessInteractionData)
	}

	// Admin routes
	admin := router.Group("/admin")
	admin.Use(middleware.AuthMiddleware(), middleware.AdminMiddleware())
	{
		// Admin endpoints can be added here
		admin.GET("/visualize", viewHandler.ServeVisualize)
		admin.GET("/users", viewHandler.ServeAdminUsers)
		admin.GET("/api/users/search", apiHandler.SearchUsers)
	}

	// Start server
	addr := cfg.GetServerAddress()
	log.Infof("Starting server on %s", addr)
	if err := router.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
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
	err = db.AutoMigrate(&models.User{}, &models.Assessment{})
	if err != nil {
		return nil, err
	}

	return db, nil
}
