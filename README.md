# Cognitive Reporting Application (CRA)

## Overview
The Cognitive Reporting Application (CRA) is a comprehensive daily monitoring tool designed to track patient symptoms and cognitive function over time. The app enables patients to log daily symptom severity, medication changes, significant events, and complete brief cognitive assessments, creating a comprehensive dataset for healthcare providers to monitor patient progress and identify patterns.

## Purpose
This application aims to:
- Provide a standardized method for patients to track symptom severity
- Collect cognitive performance metrics through validated tests
- Identify potential correlations between symptoms, environmental factors, and cognitive function
- Support research and treatment planning with quantifiable longitudinal data
- Enable remote monitoring of patient progress between clinical visits

## Features
- **Daily Symptom Tracking**: Record severity of symptoms including headache, cognitive dysfunction, tinnitus, dizziness, and visual symptoms
- **Cognitive Assessments**: Built-in Continuous Performance Test (CPT) and Trail Making Test (TMT) to measure attention, processing speed, and cognitive flexibility
- **Interaction Analysis**: Advanced metrics that analyze keyboard and mouse behavior to detect subtle cognitive changes
- **Push Notifications**: Configurable reminders to ensure consistent daily reporting
- **Administrative Dashboard**: For clinicians to monitor patient progress and analyze trends
- **Multi-device Support**: Responsive design that works across desktop and mobile devices
- **Secure Authentication**: JWT-based authentication with device tracking

## Technology Stack
- **Frontend**: React.js with Chart.js for data visualization
- **Backend**: Go (Golang) with Gin web framework
- **Database**: PostgreSQL
- **Authentication**: JWT with refresh tokens
- **Notifications**: Web Push API and SMTP email
- **Containerization**: Docker with multi-stage builds
- **Development Environment**: VS Code Dev Containers

## Project Structure
```
/
├── .devcontainer/        # Development container configuration
├── .vscode/              # VSCode settings and launch configurations
├── client/               # React frontend
│   ├── public/           # Static files and templates
│   │   ├── templates/    # HTML templates for emails and app
│   │   └── service-worker.js # PWA service worker
│   └── src/              # React components and logic
│       ├── components/   # React components
│       ├── context/      # React context providers
│       ├── services/     # API services
│       └── styles/       # CSS styles
├── config/               # Application configuration
│   ├── config.yaml       # Main configuration
│   └── questions.yaml    # Question definitions
├── docker/               # Docker configuration
├── logs/                 # Log dir
├── server/               # Go backend
│   ├── cmd/              # Application entry points
│   └── internal/         # Internal packages
│       ├── config/       # Configuration handling
│       ├── handlers/     # HTTP request handlers
│       ├── metrics/      # Data analysis and metrics
│       ├── middleware/   # HTTP middleware
│       ├── models/       # Data models
│       ├── repository/   # Data access layer
│       ├── scheduler/    # Background tasks
│       ├── services/     # Business logic
│       ├── utils/        # Utility functions
│       └── validation/   # Input validation
└── certs/                # TLS certificates (not tracked in git)
```

## Getting Started

### Prerequisites
- Docker and Docker Compose
- VS Code with Remote Containers extension (optional, but recommended)
- Go 1.24+ (if developing outside container)
- Node.js 20+ (if developing outside container)
- PostgreSQL 17+ (if developing outside container)

### Development with VS Code Dev Containers
1. Clone the repository
   ```
   git clone https://github.com/yourusername/crapp.git
   cd crapp
   ```

2. Create a `.env` file in the 'docker' directory with the following variables:
   ```
   POSTGRES_USER=crapp
   POSTGRES_PASSWORD=yourpassword
   POSTGRES_DB=crapp
   JWT_SECRET=your-256-bit-secret
   VAPID_PUBLIC_KEY=your-vapid-public-key
   VAPID_PRIVATE_KEY=your-vapid-private-key
   SMTP_USERNAME=your-email-username
   SMTP_PASSWORD=your-email-password
   CERT_FILE=certs/server.crt
   KEY_FILE=certs/server.key
   SERVER_PORT=5050
   ```

3. Generate self-signed certificates for development (if they don't exist)
   ```
   mkdir -p certs
   openssl req -x509 -newkey rsa:4096 -keyout certs/server.key -out certs/server.crt -days 365 -nodes
   ```

4. Open in VS Code with Dev Containers
   - Open VS Code
   - Install the "Remote - Containers" extension if not already installed
   - Open the command palette (F1) and select "Remote-Containers: Open Folder in Container"
   - Select the project directory

5. Start the application
   - Press F5 or use the "Run and Debug" panel to start the application
   - The application will be available at https://localhost:5050