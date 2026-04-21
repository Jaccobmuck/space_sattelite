# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install dependencies for client and server
RUN cd client && npm install && cd ../server && npm install

# Copy source files
COPY . .

# Build client
RUN cd client && npm run build

# Build server
RUN cd server && npm run build

# Production stage
FROM node:20-alpine AS production

# Create a non-root user/group to run the process
RUN addgroup -S sentry && adduser -S -G sentry sentry

WORKDIR /app/server

# Copy server package files and install production dependencies
COPY server/package*.json ./
RUN npm install --omit=dev

# Copy built server
COPY --from=builder /app/server/dist ./dist

# Copy built client to server's public directory
COPY --from=builder /app/client/dist ./public

# Transfer ownership to the non-root user before switching
RUN chown -R sentry:sentry /app/server
USER sentry

# Expose port
EXPOSE 3001

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Start server
CMD ["node", "dist/index.js"]
