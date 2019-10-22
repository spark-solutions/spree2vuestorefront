FROM node:10.16

WORKDIR /app

COPY . /app/
RUN yarn install
RUN yarn build

RUN chmod u+x dist/index.js

# TODO: find an EASY way to use a non-root USER:
# RUN useradd -m noroot
# USER noroot

CMD [ "./docker-entrypoint.sh" ]
