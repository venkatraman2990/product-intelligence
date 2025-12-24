# Product Intelligence

Contract extraction and intelligence platform for processing and analyzing contract documents.

## Overview

This is a full-stack application with:
- **Backend**: Python FastAPI (port 8000) - RESTful API for contract management and extraction
- **Frontend**: React + Vite + TypeScript + Tailwind CSS v4 (port 5000)

## Project Structure

```
├── backend/           # FastAPI backend
│   ├── api/routes/    # API endpoints (contracts, extractions, exports, models)
│   ├── core/          # Configuration and database setup
│   ├── models/        # SQLAlchemy database models
│   ├── schemas/       # Pydantic schemas
│   └── services/      # Business logic services
├── frontend/          # React frontend
│   ├── src/
│   │   ├── api/       # API client
│   │   ├── components/# React components
│   │   ├── pages/     # Page components
│   │   └── types/     # TypeScript types
├── src/               # Core extraction library
│   ├── exporters/     # Excel export functionality
│   ├── extractors/    # Document loading and LLM extraction
│   └── schema/        # Contract schema definitions
├── config/            # Application configuration
├── data/              # Input/output data directories
└── tests/             # Test suite
```

## Running the Application

The application runs with two workflows:
1. **Backend API**: `python -m uvicorn backend.main:app --host localhost --port 8000 --reload`
2. **Frontend**: `npm run dev` (in frontend directory, runs on port 5000)

## Database

- Uses SQLite by default (stored at `data/product_intelligence.db`)
- PostgreSQL can be enabled by setting `USE_SQLITE=false` and `DATABASE_URL` environment variable

## Configuration

- Backend configuration: `backend/core/config.py`
- Frontend Vite config: `frontend/vite.config.ts`
- Frontend API client uses proxy to backend at `/api`

## Key Features

- Upload and manage contract documents (PDF, DOCX)
- Extract contract data using LLM providers (Anthropic, OpenAI)
- Export extraction results to Excel
- Dashboard with contract statistics

## Environment Variables (Optional)

- `USE_SQLITE`: Set to "false" to use PostgreSQL (default: "true")
- `DATABASE_URL`: PostgreSQL connection string
- `ANTHROPIC_API_KEY`: For Anthropic Claude extractions
- `OPENAI_API_KEY`: For OpenAI GPT extractions

## Recent Changes

- 2024-12-24: Initial Replit setup
  - Configured Vite for Tailwind CSS v4 with @tailwindcss/postcss
  - Set up frontend proxy to backend API
  - Configured workflows for development
