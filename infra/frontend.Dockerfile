# ---------- Build Stage ----------
FROM node:18-alpine AS builder

WORKDIR /app

# Accept build arguments
ARG VITE_NODE_BACKEND_URL
ARG VITE_PYTHON_BACKEND_URL

# Set environment variables for Vite
ENV VITE_NODE_BACKEND_URL=$VITE_NODE_BACKEND_URL
ENV VITE_PYTHON_BACKEND_URL=$VITE_PYTHON_BACKEND_URL

COPY . .
RUN npm install
RUN npm run build

# ---------- Runtime Stage ----------
FROM nginx:alpine

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Add our Cloud Run compatible nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built frontend
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
