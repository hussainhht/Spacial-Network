FROM golang:1.26-bookworm AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o /out/social-server ./cmd/server
RUN go build -o /out/social-migrate ./cmd/migrate

FROM debian:bookworm-slim

RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /out/social-server /usr/local/bin/social-server
COPY --from=builder /out/social-migrate /usr/local/bin/social-migrate

RUN mkdir -p /app/data/uploads

ENV SERVER_PORT=8080

EXPOSE 8080
VOLUME ["/app/data"]

CMD ["social-server"]
