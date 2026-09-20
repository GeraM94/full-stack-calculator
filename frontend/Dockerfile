# Build: type-check and bundle the React app.
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Run: nginx serves the static files and proxies /api/ to the backend, so the
# browser talks to one origin.
FROM nginx:1.29-alpine

# The official image runs envsubst over /etc/nginx/templates/*.template at
# start-up and writes the result to /etc/nginx/conf.d/. It only substitutes
# variables that are defined in the environment, so $host and $uri survive.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

ENV BACKEND_HOST=backend \
    BACKEND_PORT=8080
EXPOSE 80
