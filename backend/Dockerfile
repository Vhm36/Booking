FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PYTHON_BIN=python3

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates python3 \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

EXPOSE 5000

CMD ["node", "src/server.js"]
