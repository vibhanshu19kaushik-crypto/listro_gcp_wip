# backend/Dockerfile.node
FROM node:20-bullseye-slim

WORKDIR /app

# Install Python + pip for scraper scripts
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps needed by scraper.py & amz_scraper.py
RUN pip3 install --no-cache-dir requests beautifulsoup4

# Install Node deps
COPY package*.json ./
RUN npm ci --omit=dev

# Copy backend source (JS + Python scrapers etc.)
COPY . .

# Cloud Run will inject PORT; default to 8080
ENV PORT=8080

EXPOSE 8080

CMD ["node", "server.js"]
