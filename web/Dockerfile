# Development Dockerfile for OptiSched Web Application
# This ensures development and production environment parity

FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Expose development port
EXPOSE 5173

# Set environment to development
ENV NODE_ENV=development

# Start development server
CMD ["npm", "run", "dev"]
