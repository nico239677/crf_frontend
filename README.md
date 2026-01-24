# CRF Analysis Frontend

A React frontend application for analyzing Case Report Forms (CRF). Doctors can upload CRF PDFs to extract patient data, receive prescription recommendations, and view similar historical cases.

## Tech Stack

- **Framework**: Vite + React 18 + TypeScript
- **Styling**: TailwindCSS v4
- **State Management**: React Query (@tanstack/react-query)
- **HTTP Client**: Axios
- **Icons**: Lucide React

## Prerequisites

- Node.js 18+ and npm
- Backend API running at `http://localhost:8000` (see main crf_search repo)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
```

Edit `.env` and set the backend API URL:
```
VITE_API_URL=http://localhost:8000
```

3. Start development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── FileUpload.tsx  # Drag-and-drop file upload
│   └── AnalysisResults.tsx  # Display analysis results
├── pages/              # Page components
│   └── Home.tsx        # Main application page
├── services/           # API integration
│   ├── api.ts         # Axios client configuration
│   └── crfService.ts  # CRF analysis API functions
├── types/             # TypeScript type definitions
│   └── crf.ts         # CRF-related interfaces
├── App.tsx            # Root component with React Query
└── main.tsx           # Application entry point
```

## Features

### File Upload
- Drag-and-drop PDF upload with visual feedback
- File type validation (PDF only)
- File size validation (configurable, default 10MB)
- Preview selected file before analysis

### CRF Analysis
- Real-time analysis status with loading indicator
- Extraction of patient data from CRF PDF
- AI-powered prescription recommendations
- Similar case matching with similarity scores

### Results Display
- Extraction status with success/error indicators
- Structured patient data in grid layout
- Prescription recommendations in highlighted section
- Similar cases with match percentage
- Option to analyze another document

## API Integration

The frontend communicates with the FastAPI backend through these endpoints:

- `POST /analyze` - Upload and analyze CRF PDF
- `POST /extract` - Extract data only (no recommendations)
- `GET /health` - API health check

See `src/services/crfService.ts` for API function implementations.

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint

### Environment Variables

- `VITE_API_URL` - Backend API base URL (required)

## Production Build

```bash
npm run build
```

The optimized production build will be in the `dist/` directory.

## Backend Integration

This frontend requires the FastAPI backend from the `crf_search` repository. Ensure the backend is running:

```bash
cd /path/to/crf_search/api
./start.sh
```

Or manually:
```bash
cd /path/to/crf_search/api
pipenv run uvicorn main:app --reload --port 8000
```

## Browser Support

Modern browsers with ES6+ support:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
