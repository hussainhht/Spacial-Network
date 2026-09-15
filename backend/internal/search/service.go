package search

import (
	"errors"
	"strings"
)

var (
	ErrQueryTooLong = errors.New("search query exceeds 100 characters")

	ErrInvalidSearchType = errors.New("invalid search type")
)

const (
	MaxQueryLength   = 100
	DefaultLimit     = 10
	MaxLimit         = 50
	SearchTypeAll    = "all"
	SearchTypeUsers  = "users"
	SearchTypeGroups = "groups"
	SearchTypePosts  = "posts"
	SearchTypeEvents = "events"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Search(viewerID int, query string, searchType string, limit int) (SearchResults, error) {
	query = strings.TrimSpace(query)

	if len([]rune(query)) > MaxQueryLength {
		return SearchResults{}, ErrQueryTooLong
	}

	searchType = strings.ToLower(strings.TrimSpace(searchType))
	if searchType == "" {
		searchType = SearchTypeAll
	}

	switch searchType {
	case SearchTypeAll, SearchTypeUsers, SearchTypeGroups, SearchTypePosts, SearchTypeEvents:
		// Valid type
	default:
		return SearchResults{}, ErrInvalidSearchType
	}

	if limit <= 0 {
		limit = DefaultLimit
	} else if limit > MaxLimit {
		limit = MaxLimit
	}

	results := SearchResults{
		Query:  query,
		Users:  make([]UserResult, 0),
		Groups: make([]GroupResult, 0),
		Posts:  make([]PostResult, 0),
		Events: make([]EventResult, 0),
	}

	if query == "" {
		return results, nil
	}

	if searchType == SearchTypeAll || searchType == SearchTypeUsers {
		users, err := s.repo.SearchUsers(viewerID, query, limit)
		if err != nil {
			return SearchResults{}, err
		}
		if users != nil {
			results.Users = users
		}
	}

	if searchType == SearchTypeAll || searchType == SearchTypeGroups {
		groups, err := s.repo.SearchGroups(viewerID, query, limit)
		if err != nil {
			return SearchResults{}, err
		}
		if groups != nil {
			results.Groups = groups
		}
	}

	if searchType == SearchTypeAll || searchType == SearchTypePosts {
		posts, err := s.repo.SearchPosts(viewerID, query, limit)
		if err != nil {
			return SearchResults{}, err
		}
		if posts != nil {
			results.Posts = posts
		}
	}

	if searchType == SearchTypeAll || searchType == SearchTypeEvents {
		events, err := s.repo.SearchEvents(viewerID, query, limit)
		if err != nil {
			return SearchResults{}, err
		}
		if events != nil {
			results.Events = events
		}
	}

	return results, nil
}
