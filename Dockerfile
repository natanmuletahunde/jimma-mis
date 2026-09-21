FROM node:22-slim

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@latest

# Copy dependency files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY artifacts/jimma-mis/package.json ./artifacts/jimma-mis/
COPY artifacts/mockup-sandbox/package.json ./artifacts/mockup-sandbox/
COPY lib/db/package.json ./lib/db/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY lib/api-spec/package.json ./lib/api-spec/
COPY scripts/package.json ./scripts/

# Install dependencies
RUN pnpm install

# Copy source code
COPY . .

# Build the entire monorepo
RUN pnpm run build

# Set environment
ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000

# Start production server
CMD ["node", "artifacts/api-server/dist/index.mjs"]
