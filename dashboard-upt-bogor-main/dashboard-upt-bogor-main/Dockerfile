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

# Spreadsheet config (runtime data)
COPY src/lib/spreadsheet-config.json /app/src/lib/spreadsheet-config.json

EXPOSE 3000
CMD ["node", "server.js"]
