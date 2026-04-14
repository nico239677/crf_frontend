// Use environment variable or fallback to localhost for development
export const PYTHON_API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
// export const PYTHON_API_BASE_URL = 'https://crfsearch-production.up.railway.app';

// Production URL (uncomment when deploying):
// const PYTHON_API_BASE_URL = 'https://crf-search.onrender.com';
