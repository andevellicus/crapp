package logger

import (
	"os"
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

var (
	// Log is the global logger
	Log *zap.Logger

	// Sugar is the global sugared logger (easier to use but slightly slower)
	Sugar *zap.SugaredLogger
)

// GormLogAdapter adapts zap logger to gorm logger interface
type GormLogAdapter struct {
	ZapLogger *zap.Logger
}

// Printf implements GORM's logger interface
func (l *GormLogAdapter) Printf(format string, args ...interface{}) {
	l.ZapLogger.Sugar().Infof(format, args...)
}

// InitLogger initializes the Zap logger
func InitLogger(logFile string, development bool) error {
	// Configure console encoder
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

	// Create stdout core
	stdoutCore := zapcore.NewCore(
		consoleEncoder,
		zapcore.AddSync(os.Stdout),
		zapcore.InfoLevel,
	)

	var cores []zapcore.Core
	cores = append(cores, stdoutCore)

	// If log file is specified, create file core
	if logFile != "" {
		// Open log file
		file, err := os.OpenFile(logFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
		if err == nil {
			fileCore := zapcore.NewCore(
				jsonEncoder,
				zapcore.AddSync(file),
				zapcore.InfoLevel,
			)
			cores = append(cores, fileCore)
		}
	}

	// Create logger with multiple cores
	core := zapcore.NewTee(cores...)

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
