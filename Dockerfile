FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# NEXT_PUBLIC_* vars must be set at build time for Next.js to embed them
# Pass via: docker build --build-arg NEXT_PUBLIC_FIREBASE_API_KEY=xxx ...
ARG NEXT_PUBLIC_HUB_API_URL=https://cloud-console-21805978769.asia-southeast2.run.app
ARG NEXT_PUBLIC_CLOUD_CONSOLE_URL=https://cloud-console-21805978769.asia-southeast2.run.app
ARG NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAnR9TE1-7Y93rEKixaGbsZFbqm-uxz8NE
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID=gcp-bridge-meshvpn
ENV NEXT_PUBLIC_HUB_API_URL=$NEXT_PUBLIC_HUB_API_URL
ENV NEXT_PUBLIC_CLOUD_CONSOLE_URL=$NEXT_PUBLIC_CLOUD_CONSOLE_URL
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID

RUN NODE_OPTIONS="--max_old_space_size=4096" npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public


# Environment
ENV HOSTNAME=0.0.0.0

ENV NODE_OPTIONS="--max-old-space-size=1536"

EXPOSE 3000
CMD ["node", "server.js"]
