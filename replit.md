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

## Accelerant Design System

The frontend follows the Accelerant Design System with:
- **Primary Color**: Accelerant Blue (#3B82F6)
- **Gray Palette**: Slate color scale (slate-50 through slate-900)
- **Cards**: 12px border radius, 20px padding, white background with subtle border
- **Tables**: Uppercase 12px headers, slate-50 background for headers
- **Buttons**: Primary buttons use Accelerant Blue, secondary buttons have blue borders
- **Sidebar**: Fixed 256px width with navigation items and settings section

CSS variables are defined in `frontend/src/index.css` for consistent theming.

## Recent Changes

- 2024-12-25: Accelerant Logo and Dashboard Redesign
  - Added Accelerant logo (blue/green bird icon + "ACCELERANT" text) to sidebar header
  - Redesigned Dashboard to match reference design with "Welcome to your workspace" heading
  - Added 4 stats cards row (Total Contracts, Total Fields, Extracted, Pending)
  - Added 4 feature cards with icons, descriptions, and colored action buttons
  - Updated sidebar navigation with chevron indicators and Admin section
  - Notification bell and green avatar in header

- 2024-12-25: Citation Preview Feature
  - Added DocumentPreview modal component with text highlighting
  - ResultsTable now shows quote icons next to fields with source citations
  - Clicking citation opens modal showing exact document passage where value was found
  - Updated extraction prompts to capture source text citations for each field

- 2024-12-24: Fixed extraction status display
  - Updated ExtractionSummary to include full extraction data (started_at, completed_at, extracted_data, extraction_notes)
  - Contract detail page now properly shows completed extractions with all extracted fields
  - Fixed duplicate upload handling to return proper JSON with existing_contract_id

- 2024-12-24: Accelerant Design System implementation
  - Redesigned all pages with consistent Accelerant styling
  - Updated Layout with sidebar navigation and breadcrumbs
  - Styled all components (FileUploader, ModelPicker, ResultsTable)
  - Added CSS variables for color palette and utility classes

- 2024-12-24: Initial Replit setup
  - Configured Vite for Tailwind CSS v4 with @tailwindcss/postcss
  - Set up frontend proxy to backend API
  - Configured workflows for development
