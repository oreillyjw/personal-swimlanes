# Single self-contained container. Mount data/ (and optionally fixtures/) as a
# volume so board.json + synced.json persist outside the image.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
# SIMULATE defaults on so the image runs offline out of the box.
ENV SIMULATE=true
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/config ./config
COPY --from=build /app/fixtures ./fixtures
COPY --from=build /app/data ./data
EXPOSE 3000
CMD ["npm", "run", "start"]
