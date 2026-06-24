FROM node:20-bookworm-slim AS build

WORKDIR /app

ARG REACT_APP_API_URL=http://localhost:5000/api
ARG DISABLE_ESLINT_PLUGIN=true

ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV DISABLE_ESLINT_PLUGIN=$DISABLE_ESLINT_PLUGIN

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80
