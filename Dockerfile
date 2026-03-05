FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Google Sheets credential
COPY google-auth/key.json /app/google-auth/key.json

# Runtime data files (read by fs.readFileSync at runtime)
COPY src/lib/spreadsheet-config.json /app/src/lib/spreadsheet-config.json
COPY --from=builder /app/src/lib/page-configs /app/src/lib/page-configs

# Environment
ENV GOOGLE_CREDS_PATH=/app/google-auth/key.json
ENV HOSTNAME=0.0.0.0

EXPOSE 3000
CMD ["node", "server.js"]
