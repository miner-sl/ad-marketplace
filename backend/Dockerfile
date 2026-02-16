# Backend Dockerfile
# Using Debian-based image instead of Alpine to avoid Rollup optional deps issues
FROM  node:20-slim AS builder

WORKDIR /app

# Copy package.json only (not package-lock.json) to avoid npm optional deps bug
# See: https://github.com/npm/cli/issues/4828
COPY package.json ./

# Install dependencies with workaround for npm optional deps bug
# Force clean install without package-lock.json
RUN npm cache clean --force && \
    rm -rf node_modules package-lock.json && \
    npm install --no-audit --include=optional

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Start the application
CMD ["node", "dist/app.mjs"]
