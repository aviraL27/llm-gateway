# Build stage
FROM node:18-alpine AS builder

WORKDIR /usr/src/app

# Copy root configurations
COPY package.json package-lock.json tsconfig.base.json ./

# Copy packages and gateway-api workspace
COPY packages/db ./packages/db
COPY packages/types ./packages/types
COPY apps/gateway-api ./apps/gateway-api

# Install dependencies for all workspaces
RUN npm ci

# Build the packages and the gateway-api app
RUN npm run build --workspace=packages/db
RUN npm run build --workspace=packages/types
RUN npm run build --workspace=apps/gateway-api

# Production stage
FROM node:18-alpine AS runner

WORKDIR /usr/src/app

# Copy built code and production node_modules from builder
COPY package.json package-lock.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/packages/db ./packages/db
COPY --from=builder /usr/src/app/packages/types ./packages/types
COPY --from=builder /usr/src/app/apps/gateway-api/dist ./apps/gateway-api/dist
COPY --from=builder /usr/src/app/apps/gateway-api/package.json ./apps/gateway-api/package.json
COPY --from=builder /usr/src/app/apps/gateway-api/node_modules ./apps/gateway-api/node_modules

# Expose the API port
EXPOSE 3000

ENV NODE_ENV=production

# Command to run
CMD ["node", "apps/gateway-api/dist/index.js"]
