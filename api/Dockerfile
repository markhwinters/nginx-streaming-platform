FROM node:24-alpine3.22 

WORKDIR /app

COPY server.js .
COPY package*.json ./

RUN npm ci

EXPOSE 3001

CMD ["node", "server.js"]