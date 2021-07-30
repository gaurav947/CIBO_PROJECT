FROM node:lts-slim

RUN mkdir -p /usr/src/app

WORKDIR /usr/src/app

COPY ["package.json", "./"]

ENV NODE_ENV=production

RUN npm install

COPY . .

EXPOSE 8086

CMD ["npm", "run", "start"]
