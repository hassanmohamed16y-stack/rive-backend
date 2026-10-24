# Admin dashboard (Vite + React): build static files, serve them with nginx.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Single-page app: unknown paths fall back to index.html (same as vercel.json rewrites).
RUN printf '%s\n' \
  'server {' \
  '  listen 80;' \
  '  root /usr/share/nginx/html;' \
  '  location /assets/ { expires 1y; add_header Cache-Control "public, immutable"; try_files $uri =404; }' \
  '  location / { add_header Cache-Control "no-cache"; try_files $uri $uri/ /index.html; }' \
  '}' > /etc/nginx/conf.d/default.conf
EXPOSE 80
