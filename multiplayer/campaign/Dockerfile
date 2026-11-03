FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY src/game/campaign ./src/game/campaign
COPY multiplayer/campaign ./multiplayer/campaign
USER node
EXPOSE 3010
CMD ["node", "multiplayer/campaign/server.mjs"]
