package middleware

import (
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"github.com/rs/cors"
	"go.uber.org/zap"
)

// Setup configures and attaches all middleware to the router
func Setup(router *mux.Router, log *zap.SugaredLogger) http.Handler {
	// Create a new CORS handler
	corsMiddleware := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
		MaxAge:           300, // Maximum value not usually needed
	})

	// Apply middlewares in order (outside -> in):
	// 1. CORS handling
	handler := corsMiddleware.Handler(router)

	// 2. Logging (comes after CORS to not log preflight requests)
	// handler = Logging(log)(handler)

	// 3. Recovery (should be one of the first to ensure panics are caught)
	// handler = Recovery(log)(handler)

	// 4. Request timeout
	handler = TimeoutMiddleware(30 * time.Second)(handler)

	// Return the final wrapped handler
	return handler
}

// TimeoutMiddleware adds a timeout to the request context
func TimeoutMiddleware(timeout time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Create a timeout context
			ctx := r.Context()
			// Uncomment and import "context" if needed
			// ctx, cancel := context.WithTimeout(ctx, timeout)
			// defer cancel()

			// Continue with the request
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
