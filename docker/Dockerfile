# Start from the official Go image to build the server
FROM golang:1.24.2 AS build

# Set working directory inside the container
WORKDIR /app

# Copy go.mod and go.sum files first for better caching
COPY go.mod go.sum ./

# Download Go module dependencies
RUN go mod download

# Install PostgreSQL development libraries required by the pq driver
RUN apt-get update && apt-get install -y postgresql-client libpq-dev

# Copy the entire project
COPY . .

# Build the Go application with optimizations
RUN CGO_ENABLED=1 GOOS=linux go build -a -installsuffix cgo -o crapp ./cmd/crapp

# Use Node.js to build the frontend
FROM node:18 AS frontend

WORKDIR /app

# Copy package files
COPY package.json package-lock.json webpack.config.js ./

# Install npm dependencies
RUN npm install

# Copy frontend source
COPY static/ ./static/

# Build frontend assets
RUN npm run build

# Final stage - use the official PostgreSQL client image
FROM debian:bullseye-slim

# Install necessary runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    tzdata \
    postgresql-client \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the binary from the build stage
COPY --from=build /app/crapp /app/
COPY --from=build /app/questions.yaml /app/
COPY --from=build /app/config.yaml /app/

# Copy static files and templates
COPY --from=frontend /app/static /app/static

# Create necessary directories
RUN mkdir -p /app/logs /app/certs

# Expose the port the app runs on
EXPOSE 5000

# Add an entrypoint script that waits for the database
COPY docker/scripts/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["/app/crapp"]