// Package search_test verifies universal-search visibility rules.
package search_test

import (
	"testing"

	"social/internal/groups"
	"social/internal/search"
	"social/tests/testutil"
)

func TestSearchGroups_HidesPrivateGroupsFromNonMembers(t *testing.T) {
	db := testutil.NewTestDB(t)
	groupsService := groups.NewService(groups.NewRepository(db), nil, nil)
	searchService := search.NewService(search.NewRepository(db))

	creator := testutil.CreateUser(t, db, testutil.NewUserOpts{
		Username: "searchcreator",
		Email:    "searchcreator@example.com",
	})
	member := testutil.CreateUser(t, db, testutil.NewUserOpts{
		Username: "searchmember",
		Email:    "searchmember@example.com",
	})
	outsider := testutil.CreateUser(t, db, testutil.NewUserOpts{
		Username: "searchoutsider",
		Email:    "searchoutsider@example.com",
	})

	publicID, err := groupsService.CreateGroup(
		creator,
		"Public constellation group",
		"Search visibility marker",
		"",
		groups.GroupPrivacyPublic,
	)
	if err != nil {
		t.Fatalf("create public group: %v", err)
	}
	privateID, err := groupsService.CreateGroup(
		creator,
		"Private constellation group",
		"Search visibility marker",
		"",
		groups.GroupPrivacyPrivate,
	)
	if err != nil {
		t.Fatalf("create private group: %v", err)
	}
	if err := groupsService.AddMember(int(privateID), member); err != nil {
		t.Fatalf("add private-group member: %v", err)
	}

	testCases := []struct {
		name     string
		viewerID int
		wantIDs  map[int64]bool
	}{
		{
			name:     "outsider only sees public group",
			viewerID: outsider,
			wantIDs:  map[int64]bool{publicID: true},
		},
		{
			name:     "member sees private group",
			viewerID: member,
			wantIDs:  map[int64]bool{publicID: true, privateID: true},
		},
		{
			name:     "creator sees private group",
			viewerID: creator,
			wantIDs:  map[int64]bool{publicID: true, privateID: true},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			results, err := searchService.Search(tc.viewerID, "constellation", search.SearchTypeGroups, 10)
			if err != nil {
				t.Fatalf("search groups: %v", err)
			}

			gotIDs := make(map[int64]bool, len(results.Groups))
			for _, group := range results.Groups {
				gotIDs[int64(group.ID)] = true
			}
			if len(gotIDs) != len(tc.wantIDs) {
				t.Fatalf("group IDs = %v, want %v", gotIDs, tc.wantIDs)
			}
			for groupID := range tc.wantIDs {
				if !gotIDs[groupID] {
					t.Errorf("group IDs = %v, want group %d", gotIDs, groupID)
				}
			}
		})
	}
}
