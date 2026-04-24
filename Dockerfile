FROM node:22-alpine
WORKDIR /backend

COPY package*.json ./
RUN npm install
COPY . .
CMD ["node", "server.js"]
