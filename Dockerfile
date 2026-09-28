# Stage 1: Build Frontend Client
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2: Production Server
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Copy root workspace and server package files
COPY package*.json ./
COPY fixtures.json* ./
COPY fixtures.json* ./server/
COPY server/package*.json ./server/

# Install server dependencies
RUN npm install --omit=dev --workspace=server

# Copy server application source
COPY server/ ./server/

# Copy built frontend assets from client-builder
COPY --from=client-builder /app/client/dist ./client/dist

# Expose server port
EXPOSE 5000

# Start HackHub application
CMD ["npm", "run", "start", "--workspace=server"]
