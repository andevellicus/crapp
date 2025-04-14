#!/bin/sh
set -e

until pg_isready -h db -U $POSTGRES_USER -d $POSTGRES_DB; do
  >&2 echo "Postgres is unavailable - sleeping"
  sleep 1
done

>&2 echo "Postgres is up - executing command"
exec "$@"