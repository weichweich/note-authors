FROM node:16-alpine

WORKDIR /app

COPY package.json yarn.lock ./

RUN yarn install

# copy source after installing dependencies for better caching
COPY . .

EXPOSE 8080

CMD [ "node", "index.js" ]