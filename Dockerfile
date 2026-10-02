# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install
COPY . .

ARG VITE_API_BASE
ARG VITE_AUTH_BASE
ARG VITE_IO_BASE
ARG VITE_USE_MOCK=false
ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_AUTH_BASE=$VITE_AUTH_BASE
ENV VITE_IO_BASE=$VITE_IO_BASE
ENV VITE_USE_MOCK=$VITE_USE_MOCK

RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN npm i -g serve
COPY --from=build /app/dist ./dist
EXPOSE 4173
CMD [ "serve", "-s", "dist", "-l", "4173" ]
