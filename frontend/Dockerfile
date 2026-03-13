# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2: Build Next.js app
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_ vars are baked into the JS bundle at build time
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
RUN npm run build

# Stage 3: Minimal production runner using Next.js standalone output
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Next.js standalone server binds to HOSTNAME:PORT
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Standalone bundle (includes only the needed node_modules subset)
COPY --from=builder /app/.next/standalone ./
# Static files must be copied separately into the standalone tree
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
