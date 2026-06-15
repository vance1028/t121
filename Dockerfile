FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm install tsx
COPY --from=builder /app/dist ./dist
COPY api ./api
COPY shared ./shared
COPY tsconfig.json ./
EXPOSE 7455
CMD ["node", "--import", "tsx", "api/server.ts"]
