FROM node:16.3.0

WORKDIR /app

COPY . /app/
RUN yarn install
RUN yarn build
RUN yarn cache clean

RUN chmod u+x dist/index.js

# TODO: find an EASY way to use a non-root USER:
# RUN useradd -m noroot
# USER noroot

CMD [ "./docker-entrypoint.sh" ]
