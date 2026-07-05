# ToolSage Backend - Dockerfile pro nasazeni na Render/Fly.io/Railway
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3001

CMD ["node", "src/index.js"]
