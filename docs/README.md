# Amazon Comparator

## Creative Mode / Listro Imagen Backend Configuration

The login page can switch into *creative mode* which authenticates against a
separate Listro Imagen Cloud Run service.  By default that backend is
reachable at:

```
https://listro-imagen-nodebackend-648176215467.asia-south1.run.app/auth/login
```

The frontend reads the URL (and the corresponding dashboard address) from
`src/api/config.js`.  You can override the values at build time with
`VITE_CREATIVE_AUTH_URL` and `VITE_CREATIVE_FRONTEND_URL` environment
variables.

### Private Cloud Run considerations

The Imagen service is deployed with `--no-allow-unauthenticated`.  A browser
can't hold a service account key, therefore direct fetch requests will be
rejected.  To make the flow work you can use the proxy handler that was added
in `python-server-cloudrun.py` (`/creative-login`).  Build the frontend with
`VITE_CREATIVE_PROXY_URL=${NODE_API_BASE_URL}/creative-login` and the client
code will automatically send credentials through the proxy which attaches a
proper ID token using Application Default Credentials (ADC).

Other alternatives are:

* make the Cloud Run service public (easiest but less secure)
* implement OAuth login on the client and obtain an ID token with
google.accounts.oauth2 libraries, then include it in the Authorization
header when calling `CREATIVE_AUTH_URL`

Once configured you can toggle creative mode via the button on the login form.


## Setup Instructions

### Frontend
1. Install dependencies: `npm install`
2. Run development server: `npm run dev`

### Backend

#### 1: Node Server
1. Navigate to backend directory: `cd backend`
2. Install dependencies:
   a.) 'npm install'
   b.) 'npm install @google-cloud/bigquery'
   c.) 'npm install async-mutex'
   
  Create virtual environment: `python3 -m venv venv`
- On Linux/Mac: `source venv/bin/activate`
3. Run server: `PORT=4000 node server.js`

#### 2: Python Server
1. Navigate to backend directory: `cd backend`
2. Create virtual environment: `python3 -m venv venv`
3. Activate virtual environment:
   - On Linux/Mac: `source venv/bin/activate`
   - On Windows: `venv\Scripts\activate`
4. Install requirements: `pip install -r requirements.txt`
5. Run server: `PORT=5000 python3 python-server.py`
 

#### Setup Environment
1. Env file with gemini key
2. Credentials.json file for Google Sheet Access
