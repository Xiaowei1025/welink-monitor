FROM node:22-bookworm-slim

WORKDIR /opt/welink-monitor

COPY package.json package-lock.json ./
RUN npm ci

COPY . ./
RUN chmod +x scripts/run-local.sh scripts/package-local.sh

ENV WELINK_MONITOR_HOST=0.0.0.0
ENV WELINK_MONITOR_PORT=4173

EXPOSE 4173

CMD ["bash", "scripts/run-local.sh"]
