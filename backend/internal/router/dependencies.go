package router

import (
	"database/sql"
	"encoding/json"
	"math"
	"strconv"

	"social/internal/auth"
	"social/internal/chat"
	"social/internal/comments"
	"social/internal/config"
	"social/internal/followers"
	"social/internal/groups"
	"social/internal/likes"
	"social/internal/notifications"
	"social/internal/posts"
	"social/internal/ratelimit"
	"social/internal/search"
	"social/internal/share"
	"social/internal/upload"
	"social/internal/users"
	"social/internal/websocket"
)

type Handlers struct {
	Auth          *auth.Handler
	Posts         *posts.Handler
	Chat          *chat.Handler
	Websocket     *websocket.Handler
	Groups        *groups.Handler
	Notifications *notifications.Handler
	Users         *users.Handler
	Comments      *comments.Handler
	Followers     *followers.Handler
	Search        *search.Handler
	Likes         *likes.Handler
	Share         *share.Handler
}

type Dependencies struct {
	Handlers Handlers

	AuthService          *auth.Service
	GroupsService        *groups.Service
	NotificationsService *notifications.Service
	FollowersService     *followers.Service
	RateLimiter          *ratelimit.Limiter
	PostsService         *posts.Service
}

func setupDependencies(db *sql.DB, cfg config.Config) (*Dependencies, error) {
	hub := websocket.NewHub()
	wsHandler := websocket.NewHandler(hub)

	// One limiter is shared across all routes: global bucket per user, endpoint bucket per (user, endpoint).
	rateLimiter := ratelimit.NewLimiter(ratelimit.LimiterConfig{
		GlobalCapacity:     cfg.RateLimitGlobalCapacity,
		GlobalRefillRate:   cfg.RateLimitGlobalRefillRate,
		GlobalPenalty:      cfg.RateLimitGlobalPenalty,
		EndpointCapacity:   cfg.RateLimitEndpointCapacity,
		EndpointRefillRate: cfg.RateLimitEndpointRefillRate,
		EndpointPenalty:    cfg.RateLimitEndpointPenalty,
	})

	notificationsRepo := notifications.NewRepository(db)
	notificationsSender := notifications.NewHubSender(hub)
	notificationsService := notifications.NewService(notificationsRepo, notificationsSender)
	notificationsHandler := notifications.NewHandler(notificationsService)

	followersRepo := followers.NewRepository(db)
	followersService := followers.NewService(followersRepo, notificationsService, hub)

	usersRepo := users.NewRepository(db)
	usersService := users.NewService(usersRepo, followersService)

	followersHandler := followers.NewHandler(followersService, usersService)

	avatarStorage, err := upload.NewAvatarStorage(cfg.UploadsDir, upload.AvatarSubdir, cfg.MaxAvatarSize)
	if err != nil {
		return nil, err
	}

	usersHandler := users.NewHandler(usersService, avatarStorage)

	groupPhotoStorage, err := upload.NewAvatarStorage(cfg.UploadsDir, upload.GroupPhotoSubdir, cfg.MaxAvatarSize)
	if err != nil {
		return nil, err
	}

	postMediaStorage, err := upload.NewMediaStorage(cfg.UploadsDir, upload.PostsSubdir, cfg.MaxMediaSize)
	if err != nil {
		return nil, err
	}

	commentMediaStorage, err := upload.NewMediaStorage(cfg.UploadsDir, upload.CommentsSubdir, cfg.MaxMediaSize)
	if err != nil {
		return nil, err
	}

	eventMediaStorage, err := upload.NewMediaStorage(cfg.UploadsDir, upload.EventsSubdir, cfg.MaxMediaSize)
	if err != nil {
		return nil, err
	}

	authRepo := auth.NewRepository(db, cfg.SessionLifetime)
	authService := auth.NewService(authRepo, usersService)
	authHandler := auth.NewHandler(
		authService,
		usersService,
		avatarStorage,
		cfg.SessionCookieName,
		cfg.CookieSecure,
		cfg.SessionLifetime,
	)

	// Groups is constructed before Posts/Comments/Chat which depend on it for membership checks.
	groupsRepo := groups.NewRepository(db)
	groupsService := groups.NewService(groupsRepo, notificationsService, hub)
	groupsHandler := groups.NewHandler(groupsService, groupPhotoStorage, eventMediaStorage)
	inviteSearchWSHandler := groups.NewInviteSearchWSHandler(groupsService, hub)

	chatRepo := chat.NewRepository(db)
	chatService := chat.NewService(chatRepo, hub, notificationsService, followersService, groupsService)
	chatHandler := chat.NewHandler(chatService)

	postsRepo := posts.NewRepository(db)
	postsService := posts.NewService(postsRepo, followersService, groupsService)
	postsHandler := posts.NewHandler(
		postsService,
		usersService,
		groupsService,
		postMediaStorage,
		cfg.SessionCookieName,
		cfg.CookieSecure,
		cfg.SessionLifetime,
	)

	commentsRepo := comments.NewRepository(db)
	commentsService := comments.NewService(commentsRepo, postsService, notificationsService)
	commentsHandler := comments.NewHandler(commentsService, commentMediaStorage)

	likesRepo := likes.NewRepository(db)
	likesService := likes.NewService(likesRepo, postsService, notificationsService)
	likesHandler := likes.NewHandler(likesService)

	// Shares are delivered as chat messages.
	shareService := share.NewService(chatService, postsService)
	shareHandler := share.NewHandler(shareService)

	// Both Chat and Groups register inbound WebSocket handlers on a single multiplexed connection per user.
	wsRouter := websocket.NewRouter()
	chatService.RegisterWSRoutes(wsRouter)
	wsRouter.Register(groups.EventInviteUserSearch, inviteSearchWSHandler.HandleInviteUserSearch)

	wsHandler.SetMessageHandler(func(senderID int64, raw []byte) {
		eventType := websocketEventType(raw)

		if shouldRateLimitWebSocketEvent(eventType) {
			userKey := "user:" + strconv.FormatInt(senderID, 10)
			endpoint := "WS " + string(eventType)

			decision := rateLimiter.Check(userKey, endpoint, 1)
			if !decision.Allowed {
				sendWebSocketRateLimitError(hub, senderID, decision)
				return
			}
		}

		wsRouter.Dispatch(senderID, raw)
	})

	searchRepo := search.NewRepository(db)
	searchService := search.NewService(searchRepo)
	searchHandler := search.NewHandler(searchService)

	return &Dependencies{
		Handlers: Handlers{
			Auth:          authHandler,
			Chat:          chatHandler,
			Websocket:     wsHandler,
			Groups:        groupsHandler,
			Posts:         postsHandler,
			Notifications: notificationsHandler,
			Users:         usersHandler,
			Comments:      commentsHandler,
			Followers:     followersHandler,
			Search:        searchHandler,
			Likes:         likesHandler,
			Share:         shareHandler,
		},
		AuthService:          authService,
		GroupsService:        groupsService,
		NotificationsService: notificationsService,
		FollowersService:     followersService,
		RateLimiter:          rateLimiter,
		PostsService:         postsService,
	}, nil
}

type wsRateLimitEnvelope struct {
	Type websocket.EventType `json:"type"`
}

func websocketEventType(raw []byte) websocket.EventType {
	var event wsRateLimitEnvelope
	if err := json.Unmarshal(raw, &event); err != nil {
		return ""
	}

	return event.Type
}

func shouldRateLimitWebSocketEvent(eventType websocket.EventType) bool {
	switch eventType {
	case chat.EventPrivateMessage, chat.EventGroupMessage:
		return true
	default:
		return false
	}
}

func sendWebSocketRateLimitError(
	hub *websocket.Hub,
	userID int64,
	decision ratelimit.Decision,
) {
	retrySeconds := int(math.Ceil(decision.RetryAfter.Seconds()))
	if retrySeconds < 0 {
		retrySeconds = 0
	}

	event, err := websocket.NewEvent(
		websocket.EventError,
		websocket.ErrorPayload{
			Message: "Too many chat messages. Try again in " +
				strconv.Itoa(retrySeconds) +
				" seconds.",
		},
	)
	if err != nil {
		return
	}

	hub.SendToUser(userID, event)
}
