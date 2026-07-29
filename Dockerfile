FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-slim
RUN npm install -g serve
WORKDIR /app
COPY --from=build /app/docs/.vitepress/dist/ dist/
RUN groupadd -g 1001 j41 && useradd -u 1001 -g j41 -s /bin/sh j41
RUN chown -R j41:j41 /app
USER j41
EXPOSE 5174
# NO -s. That is serve's SPA mode, which rewrites every not-found path to
# index.html — but VitePress builds a MULTI-page static site, so -s made
# /platform/disputes (and every other page) serve the homepage HTML with a 200.
# Browsers hid it because VitePress hydrates and client-routes to the right
# page; crawlers, llms.txt consumers and link previews got the homepage for
# every URL. Without -s, serve resolves /platform/disputes -> platform/disputes.html.
CMD ["serve", "dist", "-l", "5174"]
