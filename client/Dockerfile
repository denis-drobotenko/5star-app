FROM node:18-alpine as base
WORKDIR /usr/src/app
COPY package*.json ./

FROM base as development
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]

FROM base as builder
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine as production
COPY --from=builder /usr/src/app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"] 