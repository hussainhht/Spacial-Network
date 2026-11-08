package websocket

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	ws "github.com/gorilla/websocket"
	"social/internal/config"
	"social/internal/requestctx"
)

func TestLiveSocketSessionValidation(t *testing.T) {
	for _, direction := range []string{"inbound", "outbound", "idle"} {
		t.Run(direction, func(t *testing.T) {
			hub := NewHub()
			h := NewHandler(hub, config.Config{Production: true, TrustedOrigins: []string{"https://social.l3acler.com"}})
			var valid atomic.Bool
			valid.Store(true)
			h.SetSessionValidator("session_token", func(token string) (int, error) {
				if token != "test-session" || !valid.Load() {
					return 0, errors.New("revoked, expired or replaced")
				}
				return 42, nil
			})
			handled := make(chan struct{}, 1)
			h.SetMessageHandler(func(int64, []byte) { handled <- struct{}{} })
			s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				h.ServeWS(w, r.WithContext(requestctx.WithUserID(r.Context(), 42)))
			}))
			defer s.Close()
			conn, _, err := ws.DefaultDialer.Dial("ws"+strings.TrimPrefix(s.URL, "http"), http.Header{
				"Origin": {"https://social.l3acler.com"}, "Cookie": {"session_token=test-session"},
			})
			if err != nil {
				t.Fatal(err)
			}
			defer conn.Close()
			// Drain both registration events so the idle case exercises the
			// periodic check rather than a pending outbound application event.
			conn.SetReadDeadline(time.Now().Add(3 * time.Second))
			for i := 0; i < 2; i++ {
				if _, _, err := conn.ReadMessage(); err != nil {
					t.Fatal(err)
				}
			}
			// Verify a valid socket can dispatch application messages.
			if err := conn.WriteMessage(ws.TextMessage, []byte(`{}`)); err != nil {
				t.Fatal(err)
			}
			select {
			case <-handled:
			case <-time.After(3 * time.Second):
				t.Fatal("valid message not dispatched")
			}
			valid.Store(false)
			switch direction {
			case "inbound":
				if err := conn.WriteMessage(ws.TextMessage, []byte(`{}`)); err != nil {
					t.Fatal(err)
				}
			case "outbound":
				hub.Broadcast(Event{Type: EventUserOnline})
			}
			deadline := 3 * time.Second
			if direction == "idle" {
				deadline = sessionCheckPeriod + 3*time.Second
			}
			conn.SetReadDeadline(time.Now().Add(deadline))
			for {
				_, _, err := conn.ReadMessage()
				if err != nil {
					if timeout, ok := err.(interface{ Timeout() bool }); ok && timeout.Timeout() {
						t.Fatal("server did not close invalid session")
					}
					break
				}
			}
			select {
			case <-handled:
				t.Fatal("invalid session dispatched a message")
			default:
			}
		})
	}
}
