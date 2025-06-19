#!/bin/sh
set -e

# This script runs when the PostgreSQL container starts for the first time
echo "Initializing database for email security dashboard..."

# The database is already created by the POSTGRES_DB environment variable
# We could add any additional initialization here if needed