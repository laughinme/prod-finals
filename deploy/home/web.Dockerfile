# Production image of the web app for the home server: static build behind Caddy, which also proxies the API,
# Centrifugo, the ML service and the S3 media paths. Build context is the repository root.
FROM node:25-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci --silent --no-audit --no-fund
COPY frontend/ ./
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

FROM caddy:2.10-alpine
COPY deploy/home/Caddyfile /etc/caddy/Caddyfile
COPY --from=frontend-builder /app/dist /srv
EXPOSE 80
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
