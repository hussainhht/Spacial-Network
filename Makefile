.PHONY: server migrate seed test frontend

server:
	cd backend && go run ./cmd/server/

migrate:
	cd backend && go run ./cmd/migrate up

seed:
	cd backend && go run ./cmd/seed

test:
	cd backend && go test ./...

frontend:
	cd frontend && npm run dev
