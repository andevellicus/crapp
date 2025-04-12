#!/bin/bash
set -e

# Wait for the database to be ready
echo "Waiting for PostgreSQL..."
until pg_isready -h db -U crappuser -d crappdb; do
  sleep 1
done
echo "PostgreSQL ready!"

# Run the application
exec "$@"