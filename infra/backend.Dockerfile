# Build stage
FROM node:20-alpine as build
WORKDIR /app


# Copy package files
COPY package*.json ./
COPY package-lock.json ./


# Install dependencies
RUN npm ci


# Copy source code
COPY . .


# Build with production environment variables
ARG VITE_NODE_BACKEND_URL
ARG VITE_PYTHON_BACKEND_URL
ENV VITE_NODE_BACKEND_URL=$VITE_NODE_BACKEND_URL
ENV VITE_PYTHON_BACKEND_URL=$VITE_PYTHON_BACKEND_URL


RUN npm run build


# Production stage
FROM nginx:alpine


# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf


# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html


# Expose port
EXPOSE 80


CMD ["nginx", "-g", "daemon off;"]

