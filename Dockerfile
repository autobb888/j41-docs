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
CMD ["serve", "dist", "-l", "5174", "-s"]
