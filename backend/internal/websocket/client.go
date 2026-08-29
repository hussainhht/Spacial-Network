package websocket

import (
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

const (
	// Time allowed to write a message to the peer
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer
	pongWait = 60 * time.Second

	// Send pings to peer with this period. Must be less than pongWait.
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer (8 KB)
	maxMessageSize = 8192
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Allows connections from Next.js (cross-origin in development)
		return true
	},
}

// GetUpgrader returns the configured websocket.Upgrader
func GetUpgrader() websocket.Upgrader {
	return upgrader
}

// MessageHandler is the callback function invoked when a message arrives from a client
type MessageHandler func(senderID int64, raw []byte)

// Client is a middleman between the websocket connection and the Hub
type Client struct {
	Hub     *Hub
	Conn    *websocket.Conn
	UserID  int64
	send    chan []byte
	handler MessageHandler
}

// NewClient creates a new Client instance
func NewClient(hub *Hub, conn *websocket.Conn, userID int64, handler MessageHandler) *Client {
	return &Client{
		Hub:     hub,
		Conn:    conn,
		UserID:  userID,
		send:    make(chan []byte, 256),
		handler: handler,
	}
}

// ReadPump pumps messages from the websocket connection to the Hub/Handler.
// The application runs ReadPump in a per-connection goroutine.
func (c *Client) ReadPump() {
	defer func() {
		c.Hub.UnregisterClient(c)
		c.Conn.Close()
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
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("ws client %d read error: %v", c.UserID, err)
			}
			break
		}

		if c.handler != nil {
			c.handler(c.UserID, message)
		}
	}
}

// WritePump pumps messages from the Hub to the websocket connection.
// A goroutine running WritePump is started for each connection.
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// The Hub closed the channel
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

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

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
