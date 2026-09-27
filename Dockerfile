# Self-hosted image. Data is stored in /app/data — mount a volume there so it
# survives restarts:  docker run -p 3000:3000 -v arkria-data:/app/data \
#   -e ARKRIA_ADMIN_PASSWORD=choose-a-strong-one arkria-studio
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts ./
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
VOLUME ["/app/data"]
EXPOSE 3000
CMD ["npx", "next", "start", "-H", "0.0.0.0"]
