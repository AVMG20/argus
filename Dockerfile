FROM oven/bun:1.3.10-alpine AS builder

WORKDIR /app

# The Nitro bundling step is memory-hungry, and under Bun's runtime it balloons
# until the process is killed. Node completes the same step within a heap we can
# cap explicitly, so the build runs on Node while the output still runs on Bun.
RUN apk add --no-cache nodejs

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY . .

# Node sizes its default heap from host RAM, which lands too small on modest
# build machines. Pin it: 4 GB is enough for this build (measured ~4 GB peak
# RSS including Vite's native side) while leaving the box some headroom.
ENV NODE_OPTIONS=--max-old-space-size=4072
RUN node node_modules/nuxt/bin/nuxt.mjs build


FROM oven/bun:1.3.10-alpine

WORKDIR /app

# The schema is pushed when the container starts, not while it is built — a
# build has no database to talk to. Only the push tooling is installed here;
# the application itself ships as the self-contained bundle in .output.
# Keep these versions in step with package.json.
RUN echo '{"name":"argus-schema","type":"module","private":true}' > package.json \
  && bun add drizzle-kit@0.31.10 drizzle-orm@0.45.2 pg@8.22.0 \
  && rm -rf /root/.bun/install/cache

COPY drizzle.config.ts ./
COPY server/db ./server/db
COPY docker-entrypoint.sh ./
COPY --from=builder /app/.output ./.output

RUN chmod +x docker-entrypoint.sh

ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["bun", ".output/server/index.mjs"]
