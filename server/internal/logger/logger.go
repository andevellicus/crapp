package logger

import (
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"gopkg.in/natefinch/lumberjack.v2"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

var (
	// Log is the global logger
	Log *zap.Logger

	// Sugar is the global sugared logger (easier to use but slightly slower)
	Sugar *zap.SugaredLogger
)

// StdLogAdapter redirects standard library logs to zap
type StdLogAdapter struct {
	log *zap.Logger
}

// GormLogAdapter adapts zap logger to gorm logger interface
type GormLogAdapter struct {
	ZapLogger *zap.Logger
}

// Printf implements GORM's logger interface
func (l *GormLogAdapter) Printf(format string, args ...any) {
	l.ZapLogger.Sugar().Infof(format, args...)
}

// LogConfig holds additional logging configuration
type LogConfig struct {
	// Maximum size of log files before rotation in MB
	MaxSize int
	// Maximum number of old log files to retain
	MaxBackups int
	// Maximum age of old log files in days
	MaxAge int
	// Whether to compress old log files
	Compress bool
}

// InitLogger initializes the Zap logger with partitioning and rotation
func InitLogger(logDir string, development bool, logConfig *LogConfig) error {
	// Create logs directory if it doesn't exist
	if err := os.MkdirAll(logDir, 0755); err != nil {
		return err
	}

	// Get current timestamp for log filenames
	timestamp := time.Now().Format("2006-01-02")

	// Configure JSON encoder for file output
	jsonEncoder := zapcore.NewJSONEncoder(zapcore.EncoderConfig{
		TimeKey:        "ts",
		LevelKey:       "level",
		NameKey:        "logger",
		CallerKey:      "caller",
		FunctionKey:    zapcore.OmitKey,
		MessageKey:     "msg",
		StacktraceKey:  "stacktrace",
		LineEnding:     zapcore.DefaultLineEnding,
		EncodeLevel:    zapcore.LowercaseLevelEncoder,
		EncodeTime:     zapcore.ISO8601TimeEncoder,
		EncodeDuration: zapcore.StringDurationEncoder,
		EncodeCaller:   zapcore.ShortCallerEncoder,
	})

	// Configure console encoder for stdout
	consoleEncoder := zapcore.NewConsoleEncoder(zapcore.EncoderConfig{
		TimeKey:        "ts",
		LevelKey:       "level",
		NameKey:        "logger",
		CallerKey:      "caller",
		FunctionKey:    zapcore.OmitKey,
		MessageKey:     "msg",
		StacktraceKey:  "stacktrace",
		LineEnding:     zapcore.DefaultLineEnding,
		EncodeLevel:    zapcore.CapitalColorLevelEncoder,
		EncodeTime:     zapcore.ISO8601TimeEncoder,
		EncodeDuration: zapcore.StringDurationEncoder,
		EncodeCaller:   zapcore.ShortCallerEncoder,
	})

	// Set default log rotation config if not provided
	if logConfig == nil {
		logConfig = &LogConfig{
			MaxSize:    100, // 100 MB
			MaxBackups: 10,
			MaxAge:     30, // 30 days
			Compress:   true,
		}
	}

	// Create stdout core for terminal output
	stdoutCore := zapcore.NewCore(
		consoleEncoder,
		zapcore.AddSync(os.Stdout),
		zapcore.InfoLevel,
	)

	// Create file cores for different log levels
	errorCore := zapcore.NewCore(
		jsonEncoder,
		zapcore.AddSync(&lumberjack.Logger{
			Filename:   filepath.Join(logDir, timestamp+".error.log"),
			MaxSize:    logConfig.MaxSize,
			MaxBackups: logConfig.MaxBackups,
			MaxAge:     logConfig.MaxAge,
			Compress:   logConfig.Compress,
		}),
		zapcore.ErrorLevel,
	)

	warnCore := zapcore.NewCore(
		jsonEncoder,
		zapcore.AddSync(&lumberjack.Logger{
			Filename:   filepath.Join(logDir, timestamp+".warn.log"),
			MaxSize:    logConfig.MaxSize,
			MaxBackups: logConfig.MaxBackups,
			MaxAge:     logConfig.MaxAge,
			Compress:   logConfig.Compress,
		}),
		zapcore.WarnLevel,
	)

	infoCore := zapcore.NewCore(
		jsonEncoder,
		zapcore.AddSync(&lumberjack.Logger{
			Filename:   filepath.Join(logDir, timestamp+".info.log"),
			MaxSize:    logConfig.MaxSize,
			MaxBackups: logConfig.MaxBackups,
			MaxAge:     logConfig.MaxAge,
			Compress:   logConfig.Compress,
		}),
		zapcore.InfoLevel,
	)

	// Create logger with multiple cores
	core := zapcore.NewTee(stdoutCore, errorCore, warnCore, infoCore)

	// Create logger
	Log = zap.New(core, zap.AddCaller(), zap.AddStacktrace(zapcore.ErrorLevel))
	Sugar = Log.Sugar()

	// Set development mode if needed
	if development {
		Log = Log.WithOptions(zap.Development())
		Sugar = Log.Sugar()
	}

	// Replace global logger
	zap.ReplaceGlobals(Log)

	return nil
}

// GetLogger returns a named logger for a specific component
func GetLogger(name string) *zap.Logger {
	return Log.Named(name)
}

// GetSugaredLogger returns a named sugared logger for a specific component
func GetSugaredLogger(name string) *zap.SugaredLogger {
	return Sugar.Named(name)
}

// Sync flushes any buffered log entries
func Sync() {
	_ = Log.Sync()
}

func SetUpGormConfig(dbLogger *zap.Logger, logLevel string) *gorm.Config {
	var level gormlogger.LogLevel

	// Convert string log level to GORM log level
	switch logLevel {
	case "debug":
		level = gormlogger.Info // GORM doesn't have a debug level, so use Info
	case "info":
		level = gormlogger.Info
	case "warn":
		level = gormlogger.Warn
	case "error":
		level = gormlogger.Error
	default:
		level = gormlogger.Error
	}

	level = gormlogger.Info // TODO remove this

	return &gorm.Config{
		Logger: gormlogger.New(
			&GormLogAdapter{ZapLogger: dbLogger},
			gormlogger.Config{
				SlowThreshold:             time.Second,
				LogLevel:                  level,
				IgnoreRecordNotFoundError: true,
				Colorful:                  false,
			},
		),
	}
}

// NewStdLogAdapter creates a new adapter for redirecting standard logs to zap
func NewStdLogAdapter(logger *zap.Logger) *StdLogAdapter {
	return &StdLogAdapter{log: logger.Named("stdlog")}
}

// Write implements io.Writer, allowing this adapter to be used with log.SetOutput
func (a *StdLogAdapter) Write(p []byte) (int, error) {
	// Trim trailing newlines
	msg := strings.TrimRight(string(p), "\r\n")

	// Log at info level
	a.log.Info(msg)

	return len(p), nil
}

// RedirectStdLog redirects standard library logging to zap
func RedirectStdLog(logger *zap.Logger) {
	adapter := NewStdLogAdapter(logger)
	log.SetOutput(adapter)
	log.SetFlags(0) // Remove time prefix added by standard logger
}
