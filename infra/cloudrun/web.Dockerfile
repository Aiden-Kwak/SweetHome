FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci

COPY apps/web ./apps/web
COPY data/fixtures ./data/fixtures

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build:web

FROM nginx:1.27-alpine

COPY infra/cloudrun/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 8080
