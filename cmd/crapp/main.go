package main

import (
	"flag"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"

	"github.com/andevellicus/crapp/internal/auth"
	"github.com/andevellicus/crapp/internal/config"
	"github.com/andevellicus/crapp/internal/email"
	"github.com/andevellicus/crapp/internal/handlers"
	"github.com/andevellicus/crapp/internal/logger"
	"github.com/andevellicus/crapp/internal/middleware"
	"github.com/andevellicus/crapp/internal/push"
	"github.com/andevellicus/crapp/internal/repository"
	"github.com/andevellicus/crapp/internal/scheduler"
	"github.com/andevellicus/crapp/internal/utils"
	"github.com/andevellicus/crapp/internal/validation"
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
	logger.RedirectStdLog(log.Desugar())
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

	// Create auth service -- MUST BE DONE BEFORE SETTING UP ROUTES AND MIDDLEWARE
	// BECAUSE JWT GETS INITIALIZED
	authService := auth.NewAuthService(repo, &cfg.JWT)

	// Initialize email service if enabled
	var emailService *email.EmailService
	if cfg.Email.Enabled {
		emailService = email.NewEmailService(&cfg.Email, log)
		log.Infow("Email service initialized", "host", cfg.Email.SMTPHost)
	} else {
		log.Infow("Email service disabled")
	}
	// Initialize push service
	pushService := push.NewPushService(repo, log, cfg.PWA.VAPIDPublicKey, cfg.PWA.VAPIDPrivateKey)
	// Initialize the reminder scheduler
	reminderScheduler := scheduler.NewReminderScheduler(repo, log, cfg, pushService, emailService)

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

	// Initialize Push handler
	pushHandler := handlers.NewPushHandler(repo, log, pushService, reminderScheduler)

	// Apply middleware
	router.Use(gin.Recovery())
	router.Use(middleware.GinLogger(log))
	router.Use(middleware.SecurityHeadersMiddleware())
	// Add email service middleware to make it available in handlers
	router.Use(func(c *gin.Context) {
		if emailService != nil {
			c.Set("emailService", emailService)
		}
		c.Next()
	})

	// Add BEFORE other routes
	router.GET("/service-worker.js", func(c *gin.Context) {
		// Set proper MIME type
		c.Header("Content-Type", "application/javascript")

		// Prevent caching for development
		c.Header("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0")
		c.Header("Pragma", "no-cache")
		c.Header("Expires", "0")

		// Allow service worker to control the whole origin
		c.Header("Service-Worker-Allowed", "/")

		c.File("./static/js/service-worker.js")
	})

	// View routes
	router.GET("/", middleware.AuthRedirectMiddleware(authService), formHandler.ServeForm)
	router.GET("/login", viewHandler.ServeLogin)
	router.GET("/register", viewHandler.ServeRegister)
	router.GET("/profile", middleware.AuthMiddleware(authService), viewHandler.ServeProfile)
	router.GET("/devices", middleware.AuthMiddleware(authService), viewHandler.ServeDevices)
	router.GET("/forgot-password", viewHandler.ServeForgotPassword)
	router.GET("/reset-password", viewHandler.ServeResetPassword)

	// Auth API routes
	auth := router.Group("/api/auth")
	auth.Use(middleware.RateLimiterMiddleware(), middleware.ValidateJSON())
	{
		auth.POST("/register", middleware.ValidateRequest(validation.RegisterRequest{}), authHandler.Register)
		auth.POST("/login", middleware.ValidateRequest(validation.LoginRequest{}), authHandler.Login)
		auth.POST("/refresh", middleware.ValidateRequest(validation.RefreshTokenRequest{}), authHandler.RefreshToken)
		auth.POST("/logout", middleware.AuthMiddleware(authService), authHandler.Logout)
		// Password reset API endpoints
		auth.POST("/forgot-password", middleware.ValidateRequest(validation.ForgotPasswordRequest{}), authHandler.ForgotPassword)
		auth.GET("/validate-reset-token", authHandler.ValidateResetToken)
		auth.POST("/reset-password", middleware.ValidateRequest(validation.ResetPasswordRequest{}), authHandler.ResetPassword)
	}

	// Protected API routes
	api := router.Group("/api")
	api.Use(middleware.AuthMiddleware(authService), middleware.CSRFMiddleware(), middleware.ValidateJSON())
	{
		// User routes
		api.GET("/user", authHandler.GetCurrentUser)
		api.PUT("/user", middleware.ValidateRequest(validation.UpdateUserRequest{}), authHandler.UpdateUser)
		api.POST("/user/delete", middleware.ValidateRequest(validation.DeleteAccountRequest{}), authHandler.DeleteAccount)

		// Device routes
		api.GET("/devices", authHandler.GetUserDevices)
		api.POST("/devices/register", middleware.ValidateRequest(validation.RegisterDeviceRequest{}), authHandler.RegisterDevice)
		api.DELETE("/devices/:deviceId", authHandler.RemoveDevice)
		api.POST("/devices/:deviceId/rename", middleware.ValidateRequest(validation.RenameDeviceRequest{}), authHandler.RenameDevice)

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
		form.POST("/state/:stateId/answer", middleware.ValidateRequest(validation.SaveAnswerRequest{}), formHandler.SaveAnswer)
		form.POST("/state/:stateId/submit", middleware.ValidateRequest(validation.SubmitFormRequest{}), formHandler.SubmitForm)
	}

	// Add push notification routes
	pushRoutes := router.Group("/api/push")
	pushRoutes.Use(middleware.AuthMiddleware(authService))
	{
		pushRoutes.GET("/vapid-public-key", pushHandler.GetVAPIDPublicKey)
		pushRoutes.POST("/subscribe", middleware.ValidateRequest(validation.PushSubscriptionRequest{}), pushHandler.SubscribeUser)
		pushRoutes.GET("/preferences", pushHandler.GetPreferences)
		pushRoutes.PUT("/preferences", middleware.ValidateRequest(validation.NotificationPreferencesRequest{}), pushHandler.UpdatePreferences)
	}

	// Admin routes
	admin := router.Group("/admin")
	admin.Use(middleware.AuthMiddleware(authService), middleware.AdminMiddleware())
	{
		// Admin endpoints can be added here
		admin.GET("/charts", viewHandler.ServeCharts)
		admin.GET("/users", viewHandler.ServeAdminUsers)
		admin.GET("/api/users/search", apiHandler.SearchUsers)
	}

	// Start the reminder scheduler
	if err := reminderScheduler.Start(); err != nil {
		log.Warnw("Failed to start reminder scheduler", "error", err)
	} else {
		log.Infow("Reminder scheduler started successfully")

		// Log status of notification channels
		if pushService != nil {
			log.Infow("Push notifications enabled")
		}

		if emailService != nil {
			log.Infow("Email notifications enabled",
				"smtp_host", cfg.Email.SMTPHost,
				"from_email", cfg.Email.FromEmail)
		}
	}

	// Add token cleanup scheduler
	tokenCleanupScheduler := scheduler.NewTokenCleanupScheduler(repo, log)
	tokenCleanupScheduler.Start()

	defer tokenCleanupScheduler.Stop()
	// Make sure to stop the scheduler when the application shuts down
	defer reminderScheduler.Stop()

	// Start server
	addr := cfg.GetServerAddress()
	if cfg.TLS.Enabled {
		// Check if certificate files exist
		certFile := cfg.TLS.CertFile
		keyFile := cfg.TLS.KeyFile

		// If relative paths, make them relative to current directory
		if !filepath.IsAbs(certFile) {
			certFile = filepath.Join(".", certFile)
		}
		if !filepath.IsAbs(keyFile) {
			keyFile = filepath.Join(".", keyFile)
		}

		// Check if cert files exist
		if _, err := os.Stat(certFile); os.IsNotExist(err) {
			log.Warnf("TLS certificate file not found: %s", certFile)
			log.Infof("Generate certificates with: go run cmd/gencert/main.go")
			log.Infof("Falling back to HTTP mode")
			if err := router.Run(addr); err != nil {
				log.Fatalf("Failed to start server: %v", err)
			}
			return
		}

		if _, err := os.Stat(keyFile); os.IsNotExist(err) {
			log.Warnf("TLS key file not found: %s", keyFile)
			log.Infof("Generate certificates with: go run cmd/gencert/main.go")
			log.Infof("Falling back to HTTP mode")
			if err := router.Run(addr); err != nil {
				log.Fatalf("Failed to start server: %v", err)
			}
			return
		}

		// Start TLS server
		log.Infof("Starting TLS server on %s", addr)
		log.Infof("Using certificate: %s", certFile)
		log.Infof("Using key: %s", keyFile)

		// Optionally set up HTTP redirect server if HTTP port is specified
		if cfg.TLS.HTTPPort != 0 && cfg.TLS.HTTPPort != cfg.Server.Port {
			// Set up a simple HTTP server that redirects to HTTPS
			go func() {
				httpAddr := fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.TLS.HTTPPort)
				redirectServer := &http.Server{
					Addr: httpAddr,
					Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						// Get host without port
						host := r.Host
						if h, _, err := net.SplitHostPort(r.Host); err == nil {
							host = h
						}

						// Build the redirect URL
						httpsPort := cfg.Server.Port
						if httpsPort == 443 {
							// Don't include standard HTTPS port in URL
							url := fmt.Sprintf("https://%s%s", host, r.RequestURI)
							http.Redirect(w, r, url, http.StatusMovedPermanently)
						} else {
							url := fmt.Sprintf("https://%s:%d%s", host, httpsPort, r.RequestURI)
							http.Redirect(w, r, url, http.StatusMovedPermanently)
						}
					}),
				}

				log.Infof("Starting HTTP->HTTPS redirect server on %s", httpAddr)
				if err := redirectServer.ListenAndServe(); err != nil {
					log.Warnf("HTTP redirect server failed: %v", err)
				}
			}()
		}

		if err := router.RunTLS(addr, certFile, keyFile); err != nil {
			log.Fatalf("Failed to start TLS server: %v", err)
		}
	} else {
		// Start regular HTTP server
		log.Infof("Starting HTTP server on %s", addr)
		if err := router.Run(addr); err != nil {
			log.Fatalf("Failed to start server: %v", err)
		}
	}
}
