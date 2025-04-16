##########################
# Stage 1 - Client Build #
##########################
FROM node:23-alpine AS client-builder

WORKDIR /app

# Copy package.json and install dependencies
COPY client/package.json client/package-lock.json* ./
RUN npm ci

# Copy source files
COPY client/ ./

# Build the client
RUN npm run build

##########################
# Stage 2 - Server Build #
##########################
FROM golang:1.24.2-alpine AS server-builder

WORKDIR /app

# Copy go module files
COPY server/go.mod server/go.sum ./
RUN go mod download

# Copy source code
COPY server/ ./

# Build the Go application
RUN CGO_ENABLED=0 GOOS=linux go build -o crapp_server ./cmd/crapp/main.go

#########################
# Stage 3 - Final Image #
#########################
FROM alpine:latest

# Install CA certificates for HTTPS
RUN apk --no-cache add ca-certificates tzdata postgresql-client

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Set working directory
WORKDIR /app

# Set the desired timezone environment variable
ENV TZ=America/New_York

# Copy the binary from server builder
COPY --from=server-builder /app/crapp_server .

# Copy configuration and required files
COPY config/ /app/config/

# Create and set up directories
RUN mkdir -p /app/logs /app/certs 

# Copy static files from client builder
COPY --from=client-builder /app/dist/ /app/client/dist/
COPY client/public/templates/ /app/client/public/templates/
COPY client/public/icons/ /app/client/public/icons/
COPY client/public/manifest.json /app/client/public/manifest.json
COPY client/public/service-worker.js /app/client/public/service-worker.js

# Copy certs
COPY certs/ /app/certs/

COPY docker/db_startup.sh /app/db_startup.sh
RUN chmod +x /app/db_startup.sh

# Set proper permissions
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose the application port
EXPOSE ${SERVER_PORT}

# Command to run
ENTRYPOINT ["/app/db_startup.sh", "/app/crapp_server"]
