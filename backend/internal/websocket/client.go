package websocket

import (
	"log"
	"net/http"
	"social/internal/config"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait = 10 * time.Second

	pongWait = 60 * time.Second

	pingPeriod = (pongWait * 9) / 10

	maxMessageSize = 8192

	// Bound idle socket lifetime after logout, expiry or token replacement.
	sessionCheckPeriod = 15 * time.Second
)

// GetUpgrader retains the development helper while using the same origin policy.
func GetUpgrader() websocket.Upgrader { return newUpgrader(config.Load()) }

func newUpgrader(cfg config.Config) websocket.Upgrader {
	return websocket.Upgrader{
		ReadBufferSize: 1024, WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			origin := r.Header.Get("Origin")
			if origin == "" {
				return !cfg.Production
			}
			for _, trusted := range cfg.TrustedOrigins {
				if origin == trusted {
					return true
				}
			}
			return false
		},
	}
}

type MessageHandler func(senderID int64, raw []byte)

type Client struct {
	Hub          *Hub
	Conn         *websocket.Conn
	UserID       int64
	send         chan []byte
	done         chan struct{}
	closeOnce    sync.Once
	handler      MessageHandler
	sessionValid func() bool
}

func NewClient(hub *Hub, conn *websocket.Conn, userID int64, handler MessageHandler) *Client {
	return &Client{
		Hub:     hub,
		Conn:    conn,
		UserID:  userID,
		send:    make(chan []byte, 256),
		done:    make(chan struct{}),
		handler: handler,
	}
}

func (c *Client) Send(data []byte) bool {
	if c.done != nil {
		select {
		case <-c.done:
			return false
		default:
		}
	}

	if c.send == nil {
		return false
	}

	select {
	case c.send <- data:
		return true
	default:
		return false
	}
}

func (c *Client) Close() {
	c.closeOnce.Do(func() {
		if c.done != nil {
			close(c.done)
		}
		if c.Conn != nil {
			c.Conn.Close()
		}
	})
}

func (c *Client) ReadPump() {
	defer func() {
		c.Hub.Unregister(c)
		c.Close()
	}()

	c.Conn.SetReadLimit(maxMessageSize)
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.ErrReadLimit == err {
				log.Printf("ws client %d read limit exceeded: %v", c.UserID, err)
			}
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("ws client %d read error: %v", c.UserID, err)
			}
			break
		}

		if !c.hasValidSession() {
			return
		}
		if c.handler != nil {
			c.handler(c.UserID, message)
		}
	}
}

func (c *Client) hasValidSession() bool {
	return c.sessionValid == nil || c.sessionValid()
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	sessionTicker := time.NewTicker(sessionCheckPeriod)
	defer func() {
		ticker.Stop()
		sessionTicker.Stop()
		c.Close()
	}()

	for {
		select {
		case <-c.done:
			if c.Conn != nil {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
			}
			return

		case message := <-c.send:
			if !c.hasValidSession() {
				return
			}
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			if _, err := w.Write(message); err != nil {
				return
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-sessionTicker.C:
			if !c.hasValidSession() {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
