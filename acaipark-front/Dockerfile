FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --include=dev || { status=$?; cat /root/.npm/_logs/*-debug-0.log; exit "$status"; }

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start"]
