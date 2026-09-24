# Self-hosted PokéRogue API server
# Builds the official Pagefault Games rogueserver from source.
FROM golang:1.25-bookworm AS build

RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /src

RUN git clone --depth 1 https://github.com/pagefaultgames/rogueserver.git .
RUN go build -tags=devsetup -o /out/rogueserver .

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY --from=build /out/rogueserver /app/rogueserver

EXPOSE 8001

ENTRYPOINT ["/app/rogueserver"]
