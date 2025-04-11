package config

import (
	"fmt"
	"strings"
	"time"

	"github.com/spf13/viper"
)

// Config represents the application configuration
type Config struct {
	App           AppConfig
	Database      DatabaseConfig
	Server        ServerConfig
	Logging       LoggingConfig
	JWT           JWTConfig
	TLS           TLSConfig `mapstructure:"tls"`
	PWA           PWAConfig
	SchemaVersion string `mapstructure:"schema_version"`
	Email         EmailConfig
	Reminders     ReminderConfig
}

// AppConfig contains application-specific settings
type AppConfig struct {
	Name          string
	Environment   string
	QuestionsFile string
}

// DatabaseConfig contains database connection settings
type DatabaseConfig struct {
	Driver string
	URL    string
}

// ServerConfig contains HTTP server settings
type ServerConfig struct {
	Host string
	Port int
}

// LoggingConfig contains logging settings
type LoggingConfig struct {
	Directory string
	Level     string
	Format    string
}

// JWTConfig contains JWT settings and Secret
type JWTConfig struct {
	Secret           string        `mapstructure:"secret"`
	Expires          int           `mapstructure:"expires"`         // Access token expiration in minutes
	RefreshExpires   int           `mapstructure:"refresh_expires"` // Refresh token expiration in days
	SigningAlgorithm string        `mapstructure:"signing_algorithm"`
	Issuer           string        `mapstructure:"issuer"`
	Audience         string        `mapstructure:"audience"`
	NotBefore        time.Duration `mapstructure:"not_before"`
}

type TLSConfig struct {
	Enabled  bool   `mapstructure:"enabled"`
	CertFile string `mapstructure:"cert_file"`
	KeyFile  string `mapstructure:"key_file"`
	HTTPPort int    `mapstructure:"http_port"` // Optional HTTP port for redirect
}

// PWAConfig contains PWA configuration
type PWAConfig struct {
	Enabled         bool
	VAPIDPublicKey  string
	VAPIDPrivateKey string
}

// ReminderConfig contains reminder settings
type ReminderConfig struct {
	Frequency  string   `mapstructure:"frequency"`
	Times      []string `mapstructure:"times"`
	CutoffTime string   `mapstructure:"cutoff_time"`
}

// EmailConfig contains email settings
type EmailConfig struct {
	Enabled      bool   `mapstructure:"enabled"`
	SMTPHost     string `mapstructure:"smtp_host"`
	SMTPPort     int    `mapstructure:"smtp_port"`
	SMTPUsername string `mapstructure:"smtp_username"`
	SMTPPassword string `mapstructure:"smtp_password"`
	FromEmail    string `mapstructure:"from_email"`
	FromName     string `mapstructure:"from_name"`
	AppURL       string `mapstructure:"app_url"` // Base URL for links in emails
}

// LoadConfig initializes and loads configuration using Viper
func LoadConfig(configPath string) (*Config, error) {
	// Initialize Viper
	v := viper.New()

	// Set config name and path
	v.SetConfigName("config")

	// If a custom config path is provided, use it
	if configPath != "" {
		v.AddConfigPath(configPath)
	}

	// Add default config paths
	v.AddConfigPath(".")

	// Set environment variable prefix and auto-binding
	v.SetEnvPrefix("CRAPP")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	// Set default values
	setDefaults(v)

	// Read the config file
	if err := v.ReadInConfig(); err != nil {
		// It's ok if config file doesn't exist, we'll use env vars and defaults
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("failed to read config file: %w", err)
		}
	}

	// Create config struct
	config := &Config{
		SchemaVersion: v.GetString("schema_version"),
		App: AppConfig{
			Name:          v.GetString("app.name"),
			Environment:   v.GetString("app.environment"),
			QuestionsFile: v.GetString("app.questions_file"),
		},
		Database: DatabaseConfig{
			Driver: v.GetString("database.driver"),
			URL:    v.GetString("database.url"),
		},
		Server: ServerConfig{
			Host: v.GetString("server.host"),
			Port: v.GetInt("server.port"),
		},
		Logging: LoggingConfig{
			Directory: v.GetString("logging.directory"),
			Level:     v.GetString("logging.level"),
			Format:    v.GetString("logging.format"),
		},
		TLS: TLSConfig{
			Enabled:  v.GetBool("tls.enabled"),
			CertFile: v.GetString("tls.cert_file"),
			KeyFile:  v.GetString("tls.key_file"),
			HTTPPort: v.GetInt("tls.http_port"),
		},
		JWT: JWTConfig{
			Secret:         v.GetString("jwt.secret"),
			Expires:        v.GetInt("jwt.expires"),
			RefreshExpires: v.GetInt("jwt.refresh_expires"),
		},
		PWA: PWAConfig{
			Enabled:         v.GetBool("pwa.enabled"),
			VAPIDPublicKey:  v.GetString("pwa.vapid_public_key"),
			VAPIDPrivateKey: v.GetString("pwa.vapid_private_key"),
		},
		Reminders: ReminderConfig{
			Frequency:  v.GetString("reminders.frequency"),
			Times:      v.GetStringSlice("reminders.times"),
			CutoffTime: v.GetString("reminders.cutoff_time"),
		},
		Email: EmailConfig{
			Enabled:      v.GetBool("email.enabled"),
			SMTPHost:     v.GetString("email.smtp_host"),
			SMTPPort:     v.GetInt("email.smtp_port"),
			SMTPUsername: v.GetString("email.smtp_username"),
			SMTPPassword: v.GetString("email.smtp_password"),
			FromEmail:    v.GetString("email.from_email"),
			FromName:     v.GetString("email.from_name"),
			AppURL:       v.GetString("email.app_url"),
		},
	}

	return config, nil
}

// setDefaults sets default configuration values
func setDefaults(v *viper.Viper) {
	// App defaults
	v.SetDefault("app.name", "CRAPP")
	v.SetDefault("app.environment", "development")
	v.SetDefault("app.questions_file", "questions.yaml")

	// Database defaults
	v.SetDefault("database.driver", "sqlite")
	v.SetDefault("database.url", "crapp.db")

	// Server defaults
	v.SetDefault("server.host", "0.0.0.0")
	v.SetDefault("server.port", "5000")

	// Logging defaults
	v.SetDefault("logging.directory", "logs")
	v.SetDefault("logging.level", "info")
	v.SetDefault("logging.format", "json")

	// JWT defaults
	v.SetDefault("jwt.secret", "your-256-bit-secret") // Default, should be overridden
	v.SetDefault("jwt.expires", 15)                   // 15 minutes
	v.SetDefault("jwt.refresh_expires", 7)            // 7 days
	v.SetDefault("jwt.signing_algorithm", "HS256")
	v.SetDefault("jwt.issuer", "crapp-api")
	v.SetDefault("jwt.audience", "crapp-clients")
	v.SetDefault("jwt.not_before", time.Second*0) // Token valid immediately

	v.SetDefault("tls.enabled", false)
	v.SetDefault("tls.cert_file", "certs/server.crt")
	v.SetDefault("tls.key_file", "certs/server.key")
	v.SetDefault("tls.http_port", "8080") // For HTTP->HTTPS redirect

	// Set default PWA settings
	v.SetDefault("pwa.enabled", true)
	v.SetDefault("pwa.vapid_public_key", "")
	v.SetDefault("pwa.vapid_private_key", "")

	// Set default values for schema and reminders
	v.SetDefault("schema_version", "1.0")
	v.SetDefault("reminders.frequency", "daily")
	v.SetDefault("reminders.times", []string{"20:00"})
	v.SetDefault("reminders.cutoff_time", "10:00")

	// Set email defaults
	v.SetDefault("email.enabled", false)
	v.SetDefault("email.smtp_host", "smtp.example.com")
	v.SetDefault("email.smtp_port", 587)
	v.SetDefault("email.smtp_username", "")
	v.SetDefault("email.smtp_password", "")
	v.SetDefault("email.from_email", "noreply@example.com")
	v.SetDefault("email.from_name", "CRAPP Notification")
	v.SetDefault("email.app_url", "http://localhost:5000")
}

// IsDevelopment returns true if the app is in development mode
func (c *Config) IsDevelopment() bool {
	return strings.ToLower(c.App.Environment) == "development"
}

// IsProduction returns true if the app is in production mode
func (c *Config) IsProduction() bool {
	return strings.ToLower(c.App.Environment) == "production"
}

// GetServerAddress returns the full server address with host and port
func (c *Config) GetServerAddress() string {
	return fmt.Sprintf("%s:%d", c.Server.Host, c.Server.Port)
}

// GetLogFilePath returns the log file path with timestamp
func (c *Config) GetLogFilePath() string {
	timestamp := time.Now().Format("2006-01-02_15-04-05")
	return fmt.Sprintf("%s/crapp_%s.log", c.Logging.Directory, timestamp)
}
