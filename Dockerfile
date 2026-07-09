# ---- Stage 1: build frontend (React + Vite) ----
FROM node:22-alpine AS fe
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./frontend/
COPY package.json ./
RUN cd frontend && npm install
COPY frontend ./frontend
# Build ra ../backend/public (theo vite.config.ts)
COPY backend/package.json ./backend/package.json
RUN cd frontend && npm run build

# ---- Stage 2: build backend (Node + TS) ----
FROM node:22-alpine AS be
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json* ./
RUN npm install
COPY backend/ ./
# Copy FE build tĩnh từ stage 1
COPY --from=fe /app/backend/public ./public
# Copy tài liệu dịch vụ để Docs viewer đọc được trong image (addendum v1.6 §1)
COPY docs/services ./docs/services
RUN npm run build

# ---- Stage 3: runtime (1 image duy nhất) ----
FROM node:22-alpine AS runtime
WORKDIR /app/backend
ENV NODE_ENV=production
COPY --from=be /app/backend/package.json ./
COPY --from=be /app/backend/node_modules ./node_modules
COPY --from=be /app/backend/dist ./dist
COPY --from=be /app/backend/public ./public
COPY --from=be /app/backend/docs ./docs
# Biến môi trường bắt buộc prefix API_FETCH_MANAGER_ (xem .env.example)
EXPOSE 8080
CMD ["node", "dist/server.js"]
