package websocket

import (
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait = 10 * time.Second

	pongWait = 60 * time.Second

	pingPeriod = (pongWait * 9) / 10

	maxMessageSize = 8192
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func GetUpgrader() websocket.Upgrader {
	return upgrader
}

type MessageHandler func(senderID int64, raw []byte)

type Client struct {
	Hub       *Hub
	Conn      *websocket.Conn
	UserID    int64
	send      chan []byte
	done      chan struct{}
	closeOnce sync.Once
	handler   MessageHandler
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

		if c.handler != nil {
			c.handler(c.UserID, message)
		}
	}
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
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

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
