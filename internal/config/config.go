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
	PWA           PWAConfig
	SchemaVersion string `mapstructure:"schema_version"`
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
	Port string
}

// LoggingConfig contains logging settings
type LoggingConfig struct {
	Directory string
	Level     string
	Format    string
}

// JWTConfig contains JWT settings and Secret
type JWTConfig struct {
	Secret  string
	Expires int // expiration time in hours
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
			Port: v.GetString("server.port"),
		},
		Logging: LoggingConfig{
			Directory: v.GetString("logging.directory"),
			Level:     v.GetString("logging.level"),
			Format:    v.GetString("logging.format"),
		},
		JWT: JWTConfig{
			Secret:  v.GetString("jwt.secret"),
			Expires: v.GetInt("jwt.expires"),
		},
		PWA: PWAConfig{
			Enabled:         v.GetBool("pwa.enabled"),
			VAPIDPublicKey:  v.GetString("pwa.vapid_public_key"),
			VAPIDPrivateKey: v.GetString("pwa.vapid_private_key"),
		},
		SchemaVersion: v.GetString("schema_version"),
		Reminders: ReminderConfig{
			Frequency:  v.GetString("reminders.frequency"),
			Times:      v.GetStringSlice("reminders.times"),
			CutoffTime: v.GetString("reminders.cutoff_time"),
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
	v.SetDefault("jwt.expires", 24)                   // 24 hours

	// Set default PWA settings
	v.SetDefault("pwa.enabled", true)
	v.SetDefault("pwa.vapid_public_key", "")  // Should be set in production
	v.SetDefault("pwa.vapid_private_key", "") // Should be set in production

	// Set default values for schema and reminders
	v.SetDefault("schema_version", "1.0")
	v.SetDefault("reminders.frequency", "daily")
	v.SetDefault("reminders.times", []string{"20:00"})
	v.SetDefault("reminders.cutoff_time", "10:00")
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
	return fmt.Sprintf("%s:%s", c.Server.Host, c.Server.Port)
}

// GetLogFilePath returns the log file path with timestamp
func (c *Config) GetLogFilePath() string {
	timestamp := time.Now().Format("2006-01-02_15-04-05")
	return fmt.Sprintf("%s/crapp_%s.log", c.Logging.Directory, timestamp)
}
