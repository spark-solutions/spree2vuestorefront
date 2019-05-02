FROM node:10.15

WORKDIR /app

COPY package.json ./

RUN yarn install

COPY . ./

RUN useradd -m noroot
USER noroot

CMD [ "./entry.sh" ]
