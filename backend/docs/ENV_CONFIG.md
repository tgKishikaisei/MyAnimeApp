# Environment Configuration Guide

## Overview
The application supports three environments: **development**, **staging**, and **production**.

## Usage

### Method 1: Using ENV variable in .env file
```bash
# Edit .env file
ENV=development  # or staging, production
```

### Method 2: Using environment variable
```bash
# Linux/Mac
export ENV=production
python -m uvicorn app.main:app

# Windows
set ENV=production
python -m uvicorn app.main:app
```

### Method 3: Using environment-specific files
```bash
# Copy the appropriate template
cp .env.production .env  # For production
cp .env.staging .env     # For staging
# .env is already set for development
```

## Environments

### Development (default)
- `DEBUG=True`
- Auto-includes common CORS origins (localhost:5173, etc.)
- Verbose logging
- **Use for local development**

### Staging
- `DEBUG=True` (for debugging)
- Requires explicit CORS configuration
- Similar to production but more permissive
- **Use for pre-production testing**

### Production
- `DEBUG=False`
- Strict CORS validation (must be explicitly set)
- SECRET_KEY must be 32+ characters
- Minimal logging
- **Use for live deployment**

## Configuration Validation

The app will validate configuration on startup:
- ✅ Production requires explicit CORS origins
- ✅ Production SECRET_KEY must be strong (32+ chars)
- ✅ Database URL is automatically converted to asyncpg

## Example Configurations

### Local Development (.env)
```bash
ENV=development
PROJECT_NAME="AniFlow API"
SECRET_KEY=dev-secret-key
DATABASE_URL=postgresql://postgres:testpass123@127.0.0.1/aniflow
# BACKEND_CORS_ORIGINS auto-set to localhost:5173, etc.
```

### Production (.env.production)
```bash
ENV=production
PROJECT_NAME="AniFlow API"
SECRET_KEY=<generated-with-openssl-rand-hex-32>
DATABASE_URL=postgresql://prod_user:prod_pass@db.example.com:5432/aniflow
BACKEND_CORS_ORIGINS=["https://aniflow.com","https://www.aniflow.com"]
```

## Security Notes

⚠️ **NEVER commit .env files to git!**
- `.env` is in `.gitignore`
- Template files (`.env.production`, `.env.staging`) are safe to commit
- Always generate unique SECRET_KEY for each environment
