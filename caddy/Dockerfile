FROM node:25-alpine AS frontend-builder

WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci --silent --no-audit --no-fund

COPY frontend/ ./

ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build

FROM caddy:2.10-alpine

COPY caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=frontend-builder /app/dist /srv

EXPOSE 80 443

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
