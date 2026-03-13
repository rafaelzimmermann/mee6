# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files first
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy built files from build stage
COPY --from=build /app/dist ./dist

# Copy package.json for runtime
COPY package.json ./

# Install only production dependencies
RUN npm ci --omit=dev

EXPOSE 5173

CMD ["npm", "run", "preview"]
