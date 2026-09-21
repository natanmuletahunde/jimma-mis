FROM node:22-slim

WORKDIR /app

# Copy all files (node_modules, .env, .git are excluded by .dockerignore)
COPY . .

# Install pnpm and dependencies
RUN npm install -g pnpm@latest && pnpm install --no-frozen-lockfile

# Build the entire monorepo
RUN pnpm run build

# Set environment
ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000

# Start production server
CMD ["node", "artifacts/api-server/dist/index.mjs"]
