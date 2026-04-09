// Direct backend URLs - resolved at build time

// FOR PROD
// export const NODE_API_BASE_URL = import.meta.env.VITE_NODE_BACKEND_URL || 'https://listrov4-node-backend-648176215467.asia-south1.run.app';

// export const PYTHON_API_BASE_URL = import.meta.env.VITE_PYTHON_BACKEND_URL || 'https://listrov4-python-backend-648176215467.asia-south1.run.app';


export const PYTHON_API_BASE_URL = import.meta.env.VITE_PYTHON_BACKEND_URL || 'http://localhost:5001';
export const NODE_API_BASE_URL = import.meta.env.VITE_NODE_BACKEND_URL || 'http://localhost:4001';


// Creative mode (Listro Imagen) endpoints - browser requests will hit these URLs.
// VITE_CREATIVE_AUTH_URL should include the full /auth/login path.
export const CREATIVE_AUTH_URL = import.meta.env.VITE_CREATIVE_AUTH_URL ||
    'https://listro-imagen-nodebackend-648176215467.asia-south1.run.app/auth/login';
export const CREATIVE_FRONTEND_URL = import.meta.env.VITE_CREATIVE_FRONTEND_URL ||
    'https://listro-imagen-frontend-648176215467.asia-south1.run.app';

// When the Creative backend is private the frontend cannot contact it
// directly (browsers can't obtain service-account tokens).  A simple proxy
// is provided by the main Listro backend at `/creative-login`.
//
// By default we assume you will use that proxy; if you build the frontend with
// no explicit VITE_CREATIVE_PROXY_URL the code will default to
// `${PYTHON_API_BASE_URL}/creative-login` (the Python backend hosts the proxy).
// You can still override by setting VITE_CREATIVE_PROXY_URL manually if you
// have a different proxy host or don't want to use one at all.
export const CREATIVE_PROXY_URL =
    import.meta.env.VITE_CREATIVE_PROXY_URL ||
    `${PYTHON_API_BASE_URL.replace(/\/$/, '')}/creative-login`;