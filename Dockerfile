FROM node:10.15

WORKDIR /app

COPY package.json yarn.lock /app/

RUN yarn install
RUN yarn build

COPY . /app/
# TODO: find an EASY way to use a non-root USER:
# RUN useradd -m noroot
# USER noroot

CMD [ "./docker-entrypoint.sh" ]
