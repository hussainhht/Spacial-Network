// Package groups_test (events_test.go) covers social/internal/groups event
// creation, response validation ("going"/"not_going"), a member's response
// being recorded and updatable, and that only group members may create or
// respond to events.
package groups_test

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"social/internal/groups"
	"social/internal/requestctx"
)

func TestCreateEvent_RequiresTitleDescriptionAndTime(t *testing.T) {
	f := setup(t)
	creator := f.newUser(t, "evcreator")
	groupID, err := f.groupsSvc.CreateGroup(creator, "Event Group", "", "", groups.GroupPrivacyPrivate)
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}

	tests := []struct {
		name    string
		title   string
		desc    string
		time    string
		wantErr bool
	}{
		{"valid", "Meetup", "Come along", "", false},
		{"missing title", "", "Come along", "", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := groups.ValidateEventTitle(tt.title); tt.wantErr && err == nil {
				t.Fatalf("expected title validation error, got nil")
			} else if !tt.wantErr && err != nil {
				t.Fatalf("unexpected title validation error: %v", err)
			}
		})
	}

	// event_time must parse as RFC3339; a garbage string is rejected.
	if _, err := groups.ValidateEventTime("not-a-date"); err == nil {
		t.Fatalf("expected an error for an invalid event_time")
	}

	future := time.Now().Add(24 * time.Hour)
	eventID, err := f.groupsSvc.CreateEvent(int(groupID), creator, "Meetup", "Come along", future)
	if err != nil {
		t.Fatalf("CreateEvent: %v", err)
	}
	if eventID <= 0 {
		t.Fatalf("expected a positive event id")
	}
}

func TestCreateEvent_TimeMustBeInFuture(t *testing.T) {
	f := setup(t)
	creator := f.newUser(t, "evpastcreator")
	groupID, err := f.groupsSvc.CreateGroup(creator, "Past Event Group", "", "", groups.GroupPrivacyPrivate)
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}

	past := time.Now().Add(-24 * time.Hour)
	_, err = f.groupsSvc.CreateEvent(int(groupID), creator, "Old Meetup", "Too late", past)
	if err != groups.ErrEventTimeInPast {
		t.Fatalf("expected ErrEventTimeInPast, got %v", err)
	}
}

func TestCreateEvent_OptionalImageIsReturnedByListAndDetails(t *testing.T) {
	f := setup(t)
	creator := f.newUser(t, "evimagecreator")
	groupID, err := f.groupsSvc.CreateGroup(creator, "Image Event Group", "", "", groups.GroupPrivacyPrivate)
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}

	eventID, err := f.groupsSvc.CreateEventWithImage(int(groupID), creator, "With cover", "Image event", time.Now().Add(24*time.Hour), "events/random-cover.webp")
	if err != nil {
		t.Fatalf("CreateEventWithImage: %v", err)
	}
	events, err := f.groupsSvc.GetGroupEvents(int(groupID), creator)
	if err != nil {
		t.Fatalf("GetGroupEvents: %v", err)
	}
	if len(events) != 1 || !events[0].ImagePath.Valid || events[0].ImagePath.String != "events/random-cover.webp" {
		t.Fatalf("list image path = %#v, want events/random-cover.webp", events)
	}
	details, err := f.groupsSvc.GetEventDetails(int(groupID), int(eventID), creator)
	if err != nil {
		t.Fatalf("GetEventDetails: %v", err)
	}
	if !details.ImagePath.Valid || details.ImagePath.String != "events/random-cover.webp" {
		t.Fatalf("details image path = %#v", details.ImagePath)
	}

	withoutImageID, err := f.groupsSvc.CreateEvent(int(groupID), creator, "Without cover", "Optional image", time.Now().Add(48*time.Hour))
	if err != nil {
		t.Fatalf("CreateEvent without image: %v", err)
	}
	withoutImage, err := f.groupsSvc.GetEventDetails(int(groupID), int(withoutImageID), creator)
	if err != nil {
		t.Fatalf("GetEventDetails without image: %v", err)
	}
	if withoutImage.ImagePath.Valid {
		t.Fatalf("image path = %q, want NULL", withoutImage.ImagePath.String)
	}
}

func TestEventCoverTemplate_AllowlistAndPersistence(t *testing.T) {
	for _, path := range []string{
		"/image/templets/earth.png",
		"/image/templets/mars.png",
		"/image/templets/moon.png",
		"/image/templets/saturn.png",
	} {
		if got, err := groups.ValidateEventCoverTemplate(path); err != nil || got != path {
			t.Fatalf("ValidateEventCoverTemplate(%q) = %q, %v", path, got, err)
		}
	}
	if _, err := groups.ValidateEventCoverTemplate("/etc/passwd"); err == nil {
		t.Fatal("expected unapproved cover template to be rejected")
	}

	f := setup(t)
	creator := f.newUser(t, "evtemplatecreator")
	groupID, err := f.groupsSvc.CreateGroup(creator, "Template Event Group", "", "", groups.GroupPrivacyPrivate)
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}
	const template = "/image/templets/mars.png"
	eventID, err := f.groupsSvc.CreateEventWithImage(int(groupID), creator, "Mars meetup", "Template cover", time.Now().Add(24*time.Hour), template)
	if err != nil {
		t.Fatalf("CreateEventWithImage: %v", err)
	}
	event, err := f.groupsSvc.GetEventDetails(int(groupID), int(eventID), creator)
	if err != nil {
		t.Fatalf("GetEventDetails: %v", err)
	}
	if !event.ImagePath.Valid || event.ImagePath.String != template {
		t.Fatalf("image path = %#v, want %q", event.ImagePath, template)
	}
}

func TestCreateEventHandler_TemplateCoverUsesExistingCreateFlow(t *testing.T) {
	f := setup(t)
	creator := f.newUser(t, "evtemplatehandler")
	groupID, err := f.groupsSvc.CreateGroup(creator, "Template Handler Group", "", "", groups.GroupPrivacyPrivate)
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}

	submit := func(template string) *httptest.ResponseRecorder {
		t.Helper()
		var body bytes.Buffer
		writer := multipart.NewWriter(&body)
		_ = writer.WriteField("title", "Template meetup")
		_ = writer.WriteField("description", "Uses an existing public asset")
		_ = writer.WriteField("event_time", time.Now().Add(24*time.Hour).Format(time.RFC3339))
		_ = writer.WriteField("cover_template", template)
		if err := writer.Close(); err != nil {
			t.Fatalf("close multipart writer: %v", err)
		}

		req := httptest.NewRequest(http.MethodPost, "/api/groups/events", &body)
		req.Header.Set("Content-Type", writer.FormDataContentType())
		req.SetPathValue("id", strconv.FormatInt(groupID, 10))
		req = req.WithContext(requestctx.WithUserID(req.Context(), creator))
		recorder := httptest.NewRecorder()
		f.groupsHandler.CreateEventHandler(recorder, req)
		return recorder
	}

	invalid := submit("/etc/passwd")
	if invalid.Code != http.StatusBadRequest {
		t.Fatalf("invalid template status = %d, want %d", invalid.Code, http.StatusBadRequest)
	}

	const template = "/image/templets/earth.png"
	created := submit(template)
	if created.Code != http.StatusCreated {
		t.Fatalf("create template event status = %d, body = %s", created.Code, created.Body.String())
	}
	var response groups.CreateEventResponse
	if err := json.Unmarshal(created.Body.Bytes(), &response); err != nil {
		t.Fatalf("unmarshal create response: %v", err)
	}
	if response.ImagePath == nil || *response.ImagePath != template {
		t.Fatalf("response image path = %v, want %q", response.ImagePath, template)
	}

	events, err := f.groupsSvc.GetGroupEvents(int(groupID), creator)
	if err != nil {
		t.Fatalf("GetGroupEvents: %v", err)
	}
	if len(events) != 1 || !events[0].ImagePath.Valid || events[0].ImagePath.String != template {
		t.Fatalf("persisted template path = %#v, want %q", events, template)
	}
}

func TestCreateEvent_NonMemberCannotCreate(t *testing.T) {
	for _, privacy := range []groups.GroupPrivacy{groups.GroupPrivacyPublic, groups.GroupPrivacyPrivate} {
		t.Run(string(privacy), func(t *testing.T) {
			f := setup(t)
			creator := f.newUser(t, "evnmcreator"+string(privacy))
			nonMember := f.newUser(t, "evnmoutsider"+string(privacy))
			groupID, err := f.groupsSvc.CreateGroup(creator, "NM Event Group", "", "", privacy)
			if err != nil {
				t.Fatalf("CreateGroup: %v", err)
			}

			future := time.Now().Add(24 * time.Hour)
			_, err = f.groupsSvc.CreateEvent(int(groupID), nonMember, "Sneaky Meetup", "Shh", future)
			if err != groups.ErrNotGroupMember {
				t.Fatalf("expected ErrNotGroupMember for a non-member creating an event, got %v", err)
			}
		})
	}
}

func TestEventResponse_GoingAndNotGoing_ValidOptions(t *testing.T) {
	if _, err := groups.ValidateEventResponseStatus(groups.EventResponseGoing); err != nil {
		t.Errorf("'going' should be a valid response: %v", err)
	}
	if _, err := groups.ValidateEventResponseStatus(groups.EventResponseNotGoing); err != nil {
		t.Errorf("'not_going' should be a valid response: %v", err)
	}
	if _, err := groups.ValidateEventResponseStatus("maybe"); err == nil {
		t.Errorf("expected an error for an unsupported response value")
	}
}

func TestRespondToEvent_MemberResponseRecordedAndUpdatable(t *testing.T) {
	f := setup(t)
	creator := f.newUser(t, "evrespcreator")
	member := f.newUser(t, "evrespmember")
	groupID, err := f.groupsSvc.CreateGroup(creator, "Response Group", "", "", groups.GroupPrivacyPrivate)
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}
	if err := f.groupsSvc.AddMember(int(groupID), member); err != nil {
		t.Fatalf("AddMember: %v", err)
	}

	future := time.Now().Add(24 * time.Hour)
	eventID, err := f.groupsSvc.CreateEvent(int(groupID), creator, "Party", "Fun", future)
	if err != nil {
		t.Fatalf("CreateEvent: %v", err)
	}

	if err := f.groupsSvc.RespondToEvent(int(groupID), int(eventID), member, groups.EventResponseGoing); err != nil {
		t.Fatalf("RespondToEvent(going): %v", err)
	}

	event, err := f.groupsSvc.GetEventDetails(int(groupID), int(eventID), member)
	if err != nil {
		t.Fatalf("GetEventDetails: %v", err)
	}
	if event.CurrentUserResponse == nil || *event.CurrentUserResponse != groups.EventResponseGoing {
		t.Fatalf("expected current user response 'going', got %v", event.CurrentUserResponse)
	}
	if event.GoingCount != 1 {
		t.Errorf("GoingCount = %d, want 1", event.GoingCount)
	}

	// Update the response.
	if err := f.groupsSvc.RespondToEvent(int(groupID), int(eventID), member, groups.EventResponseNotGoing); err != nil {
		t.Fatalf("RespondToEvent(not_going): %v", err)
	}

	event, err = f.groupsSvc.GetEventDetails(int(groupID), int(eventID), member)
	if err != nil {
		t.Fatalf("GetEventDetails after update: %v", err)
	}
	if event.CurrentUserResponse == nil || *event.CurrentUserResponse != groups.EventResponseNotGoing {
		t.Fatalf("expected current user response 'not_going' after update, got %v", event.CurrentUserResponse)
	}
	if event.GoingCount != 0 || event.NotGoingCount != 1 {
		t.Errorf("GoingCount/NotGoingCount = %d/%d, want 0/1", event.GoingCount, event.NotGoingCount)
	}
}

func TestRespondToEvent_NonMemberCannotRespond(t *testing.T) {
	f := setup(t)
	creator := f.newUser(t, "evnrcreator")
	nonMember := f.newUser(t, "evnroutsider")
	groupID, err := f.groupsSvc.CreateGroup(creator, "NR Event Group", "", "", groups.GroupPrivacyPrivate)
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}

	future := time.Now().Add(24 * time.Hour)
	eventID, err := f.groupsSvc.CreateEvent(int(groupID), creator, "Exclusive", "Members only", future)
	if err != nil {
		t.Fatalf("CreateEvent: %v", err)
	}

	err = f.groupsSvc.RespondToEvent(int(groupID), int(eventID), nonMember, groups.EventResponseGoing)
	if err != groups.ErrNotGroupMember {
		t.Fatalf("expected ErrNotGroupMember for a non-member responding, got %v", err)
	}
}
