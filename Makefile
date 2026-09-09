.PHONY: server migrate test frontend

server:
	cd backend && go run ./cmd/server/

migrate:
	cd backend && go run ./cmd/migrate up

test:
	cd backend && go test ./...

frontend:
	cd frontend && npm run dev
