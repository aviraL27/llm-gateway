# Build stage
FROM node:18-alpine AS builder

WORKDIR /usr/src/app

# Copy root configurations
COPY package.json package-lock.json tsconfig.base.json ./

# Copy packages and worker workspace
COPY packages/db ./packages/db
COPY packages/types ./packages/types
COPY apps/worker ./apps/worker

# Install dependencies for all workspaces
RUN npm ci

# Build the packages and the worker app
RUN npm run build --workspace=packages/db
RUN npm run build --workspace=packages/types
RUN npm run build --workspace=apps/worker

# Production stage
FROM node:18-alpine AS runner

WORKDIR /usr/src/app

# Copy built code and production node_modules from builder
COPY package.json package-lock.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/packages/db ./packages/db
COPY --from=builder /usr/src/app/packages/types ./packages/types
COPY --from=builder /usr/src/app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /usr/src/app/apps/worker/package.json ./apps/worker/package.json
COPY --from=builder /usr/src/app/apps/worker/node_modules ./apps/worker/node_modules

ENV NODE_ENV=production

# Command to run
CMD ["node", "apps/worker/dist/index.js"]
