# 1. Aşama: Build
FROM node:20-slim AS build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# 2. Aşama: Production (Nginx ile servis etme)
FROM nginx:alpine
# Build aşamasından gelen dosyaları kopyala (Klasör adının 'dist' olduğundan emin ol)
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Cloud Run'ın PORT değişkenini Nginx'e geçirmek için küçük bir ayar
# Nginx varsayılan olarak 80 portunu kullanır, Cloud Run 8080 bekler.
RUN sed -i 's/listen\s\+80;/listen 8080;/g' /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
