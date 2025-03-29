package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/andevellicus/crapp/internal/auth"
	"github.com/andevellicus/crapp/internal/config"
	"github.com/andevellicus/crapp/internal/handlers"
	"github.com/andevellicus/crapp/internal/logger"
	"github.com/andevellicus/crapp/internal/middleware"
	"github.com/andevellicus/crapp/internal/repository"
	"github.com/andevellicus/crapp/internal/utils"
	"github.com/gin-gonic/gin"
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

	// Create repository
	repo := repository.NewRepository(cfg, log, questionLoader)

	// Initialize JWT -- MUST BE DONE BEFORE SETTING UP ROUTES AND MIDDLEWARE
	//auth.InitJWT(&cfg.JWT)
	// Create auth service
	authService := auth.NewAuthService(repo, &cfg.JWT)

	// Create Gin router
	router := gin.New()

	// Set the template engine
	router.SetHTMLTemplate(handlers.SetupTemplates())

	// Static files
	router.Static("/static", "./static")

	// Initialize handlers
	apiHandler := handlers.NewAPIHandler(repo, log, questionLoader)
	viewHandler := handlers.NewViewHandler("static")
	// Create auth handler
	authHandler := handlers.NewAuthHandler(repo, log, authService)
	// Create form handler
	formHandler := handlers.NewFormHandler(repo, log, questionLoader)

	// Apply middleware
	router.Use(gin.Recovery())
	router.Use(middleware.GinLogger(log))

	// View routes
	router.GET("/", middleware.AuthRedirectMiddleware(authService), formHandler.ServeForm)
	router.GET("/login", viewHandler.ServeLogin)
	router.GET("/register", viewHandler.ServeRegister)
	router.GET("/profile", middleware.AuthMiddleware(authService), viewHandler.ServeProfile)
	router.GET("/devices", middleware.AuthMiddleware(authService), viewHandler.ServeDevices)

	// Auth API routes
	auth := router.Group("/api/auth")
	{
		auth.POST("/register", authHandler.Register)
		auth.POST("/login", authHandler.Login)
		// Password reset endpoints could be added here
	}

	// Protected API routes
	api := router.Group("/api")
	api.Use(middleware.AuthMiddleware(authService))
	{
		// User routes
		api.GET("/user", authHandler.GetCurrentUser)
		api.PUT("/user", authHandler.UpdateUser)

		// Device routes
		api.GET("/devices", authHandler.GetUserDevices)
		api.POST("/devices/register", authHandler.RegisterDevice)
		api.DELETE("/devices/:deviceId", authHandler.RemoveDevice)
		api.POST("/devices/:deviceId/rename", authHandler.RenameDevice)

		// Question routes
		api.GET("/questions", apiHandler.GetQuestions)
		api.GET("/questions/symptoms", apiHandler.GetSymptomQuestions)

		// Metric routes
		api.GET("/metrics/chart/correlation", apiHandler.GetChartCorrelationData)
		api.GET("/metrics/chart/timeline", apiHandler.GetChartTimelineData)
	}

	form := router.Group("/api/form")
	form.Use(middleware.AuthMiddleware(authService))
	{
		form.POST("/init", formHandler.InitForm)
		form.GET("/state/:stateId", formHandler.GetCurrentQuestion)
		form.POST("/state/:stateId/answer", formHandler.SaveAnswer)
		form.POST("/state/:stateId/submit", formHandler.SubmitForm)
	}

	// Admin routes
	admin := router.Group("/admin")
	admin.Use(middleware.AuthMiddleware(authService), middleware.AdminMiddleware())
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
