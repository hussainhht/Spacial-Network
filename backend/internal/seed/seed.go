package seed

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type SeedOptions struct {
	Clean bool
}

type UserSeed struct {
	Username    string
	Email       string
	FirstName   string
	LastName    string
	Age         int
	Gender      string
	Nickname    string
	AboutMe     string
	DateOfBirth string
	IsPrivate   int
}

type GroupSeed struct {
	CreatorUsername string
	Title           string
	Description     string
	Privacy         string
}

type PostSeed struct {
	AuthorUsername string
	Title          string
	Content        string
	Visibility     string
	GroupTitle     string // empty for standard feed post, or matching group title
	AllowedViewers []string
	CreatedOffset  time.Duration
}

type CommentSeed struct {
	AuthorUsername string
	PostTitle      string
	Content        string
	CreatedOffset  time.Duration
}

type EventSeed struct {
	GroupTitle      string
	CreatorUsername string
	Title           string
	Description     string
	EventOffset     time.Duration // offset from now (positive for future)
}

type PrivateMessageSeed struct {
	SenderUsername    string
	RecipientUsername string
	Content           string
	Read              bool
	CreatedOffset     time.Duration
}

type GroupMessageSeed struct {
	GroupTitle     string
	AuthorUsername string
	Content        string
	CreatedOffset  time.Duration
}

// Run executes the database seeding with realistic space-themed social network data.
func Run(db *sql.DB, opts SeedOptions) error {
	now := time.Now().UTC()

	if opts.Clean {
		log.Println("🧹 Cleaning existing data from tables...")
		if err := truncateAll(db); err != nil {
			return fmt.Errorf("truncate tables: %w", err)
		}
	}

	const defaultPassword = "Password123!"
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(defaultPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}
	hashStr := string(hashedPassword)

	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback()

	users := []UserSeed{
		{
			Username:    "alice",
			Email:       "alice@space.net",
			FirstName:   "Alice",
			LastName:    "Walker",
			Age:         28,
			Gender:      "female",
			Nickname:    "StarGazer",
			AboutMe:     "Astrophysicist & telemetry engineer. Tracking planetary transits, solar winds, and lunar orbit mechanics. Always looking up. 🔭✨",
			DateOfBirth: "1998-04-12",
			IsPrivate:   0,
		},
		{
			Username:    "bob",
			Email:       "bob@quantum.io",
			FirstName:   "Bob",
			LastName:    "Vance",
			Age:         32,
			Gender:      "male",
			Nickname:    "QuantumBob",
			AboutMe:     "Quantum computing researcher & propulsion systems builder. Exploring ion propulsion, gravitational harmonics, and deep-space communications. 🚀",
			DateOfBirth: "1994-08-23",
			IsPrivate:   0,
		},
		{
			Username:    "charlie",
			Email:       "charlie@astro-lens.org",
			FirstName:   "Charlie",
			LastName:    "Davis",
			Age:         26,
			Gender:      "male",
			Nickname:    "NebulaHunter",
			AboutMe:     "Astrophotographer. Chasing auroras, deep-sky nebulae, and solar flares with my 14-inch Schmidt-Cassegrain rig. 📸🌌",
			DateOfBirth: "2000-02-15",
			IsPrivate:   1, // Private profile for testing follow requests
		},
		{
			Username:    "diana",
			Email:       "diana@bio-cosmos.net",
			FirstName:   "Diana",
			LastName:    "Prince",
			Age:         30,
			Gender:      "female",
			Nickname:    "AstroFlora",
			AboutMe:     "Astro-botanist studying closed-loop bioregenerative life support systems and microgravity plant cultivation for lunar habitats. 🌱🛸",
			DateOfBirth: "1996-06-19",
			IsPrivate:   0,
		},
		{
			Username:    "elena",
			Email:       "elena@geoplanet.org",
			FirstName:   "Elena",
			LastName:    "Rostova",
			Age:         29,
			Gender:      "female",
			Nickname:    "OrbitGeologist",
			AboutMe:     "Planetary geologist analyzing Lunar and Martian regolith samples. Specializing in meteorite impact melt and volcanic basalt formations. 🪐💎",
			DateOfBirth: "1997-11-03",
			IsPrivate:   0,
		},
		{
			Username:    "frank",
			Email:       "frank@zero-g.space",
			FirstName:   "Frank",
			LastName:    "Castle",
			Age:         35,
			Gender:      "male",
			Nickname:    "ArchitectZero",
			AboutMe:     "Structural engineer and space habitat designer. Focused on modular orbital ring architectures and radiation shielding materials. 🏗️🛡️",
			DateOfBirth: "1991-09-21",
			IsPrivate:   1, // Private profile
		},
		{
			Username:    "grace",
			Email:       "grace@deeprelay.com",
			FirstName:   "Grace",
			LastName:    "Hopper",
			Age:         31,
			Gender:      "female",
			Nickname:    "SignalGrace",
			AboutMe:     "Deep-space communication protocols engineer. Building laser optical relays and quantum encryption algorithms for interplanetary networks. 📡⚡",
			DateOfBirth: "1995-12-09",
			IsPrivate:   0,
		},
		{
			Username:    "cosmonaut",
			Email:       "cosmonaut@social.local",
			FirstName:   "Cosmo",
			LastName:    "Naut",
			Age:         27,
			Gender:      "male",
			Nickname:    "Voyager",
			AboutMe:     "Explorer of new frontiers. Pair programmer, cosmic navigator, and stellar community member. 🛰️🌟",
			DateOfBirth: "1999-01-01",
			IsPrivate:   0,
		},
	}

	userIDs := make(map[string]int)
	userStmt, err := tx.Prepare(`
		INSERT INTO users (uuid, username, age, gender, first_name, last_name, email, password_hash, is_private, nickname, about_me, date_of_birth, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return fmt.Errorf("prepare insert user: %w", err)
	}
	defer userStmt.Close()

	for idx, u := range users {
		userUUID := uuid.New().String()
		userCreatedAt := now.Add(-time.Duration(30-idx) * 24 * time.Hour)
		res, err := userStmt.Exec(
			userUUID,
			u.Username,
			u.Age,
			u.Gender,
			u.FirstName,
			u.LastName,
			u.Email,
			hashStr,
			u.IsPrivate,
			u.Nickname,
			u.AboutMe,
			u.DateOfBirth,
			userCreatedAt,
			userCreatedAt,
		)
		if err != nil {
			return fmt.Errorf("insert user %s: %w", u.Username, err)
		}
		id, err := res.LastInsertId()
		if err != nil {
			return err
		}
		userIDs[u.Username] = int(id)
	}
	log.Printf("✅ Inserted %d users (all have password: %s)", len(users), defaultPassword)

	// Mutual follows enable direct messaging between pairs
	followPairs := [][2]string{
		{"alice", "bob"},
		{"bob", "alice"},
		{"alice", "diana"},
		{"diana", "alice"},
		{"bob", "elena"},
		{"elena", "bob"},
		{"diana", "grace"},
		{"grace", "diana"},
		{"cosmonaut", "alice"},
		{"alice", "cosmonaut"},
		{"cosmonaut", "bob"},
		{"bob", "cosmonaut"},
		{"alice", "elena"},
		{"bob", "diana"},
		{"elena", "grace"},
		{"grace", "alice"},
		{"cosmonaut", "diana"},
		{"cosmonaut", "elena"},
	}

	followerStmt, err := tx.Prepare(`
		INSERT INTO followers (follower_id, followed_id, created_at)
		VALUES (?, ?, ?)
	`)
	if err != nil {
		return fmt.Errorf("prepare insert follower: %w", err)
	}
	defer followerStmt.Close()

	for _, p := range followPairs {
		followerID := userIDs[p[0]]
		followedID := userIDs[p[1]]
		if _, err := followerStmt.Exec(followerID, followedID, now.Add(-10*24*time.Hour)); err != nil {
			return fmt.Errorf("insert follower %s -> %s: %w", p[0], p[1], err)
		}
	}
	log.Printf("✅ Inserted %d follow connections (with mutual follows for chat)", len(followPairs))

	// Follow requests for private accounts (charlie & frank)
	followRequests := []struct {
		Requester string
		Target    string
		Status    string
	}{
		{"elena", "charlie", "pending"},
		{"grace", "charlie", "accepted"},
		{"bob", "frank", "pending"},
		{"cosmonaut", "frank", "pending"},
		{"alice", "frank", "accepted"},
	}

	followReqStmt, err := tx.Prepare(`
		INSERT INTO follow_requests (requester_id, target_id, status, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?)
	`)
	if err != nil {
		return fmt.Errorf("prepare insert follow request: %w", err)
	}
	defer followReqStmt.Close()

	for _, fr := range followRequests {
		reqID := userIDs[fr.Requester]
		targetID := userIDs[fr.Target]
		reqTime := now.Add(-2 * 24 * time.Hour)
		if _, err := followReqStmt.Exec(reqID, targetID, fr.Status, reqTime, reqTime); err != nil {
			return fmt.Errorf("insert follow request %s -> %s: %w", fr.Requester, fr.Target, err)
		}
	}
	log.Printf("✅ Inserted %d follow requests", len(followRequests))

	groups := []GroupSeed{
		{
			CreatorUsername: "alice",
			Title:           "Orbital Explorers Club",
			Description:     "A sanctuary for stargazers, orbit navigators, and orbital telemetry enthusiasts. We coordinate observation runs and satellite passes.",
			Privacy:         "public",
		},
		{
			CreatorUsername: "bob",
			Title:           "Quantum Cosmos Research",
			Description:     "Dedicated to the intersection of quantum entanglement, gravitational wave detection, and next-generation ion propulsion drives.",
			Privacy:         "public",
		},
		{
			CreatorUsername: "charlie",
			Title:           "Astro-Photographers Guild",
			Description:     "Showcase and discuss wide-field milky way captures, narrowband nebula processing, lunar mosaic stitching, and CCD sensor calibration.",
			Privacy:         "public",
		},
		{
			CreatorUsername: "diana",
			Title:           "Deep Space Pioneers",
			Description:     "Exclusive consortium designing closed-loop life support and coordinating deep-space exploration manifests.",
			Privacy:         "private",
		},
		{
			CreatorUsername: "frank",
			Title:           "Zero-G Habitat Architects",
			Description:     "Blueprints, simulation data, and materials engineering for rotating artificial-gravity habitats and lunar regolith shelters.",
			Privacy:         "public",
		},
	}

	groupIDs := make(map[string]int)
	groupStmt, err := tx.Prepare(`
		INSERT INTO groups (creator_id, title, description, privacy, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return fmt.Errorf("prepare insert group: %w", err)
	}
	defer groupStmt.Close()

	for idx, g := range groups {
		creatorID := userIDs[g.CreatorUsername]
		groupCreated := now.Add(-time.Duration(20-idx) * 24 * time.Hour)
		res, err := groupStmt.Exec(creatorID, g.Title, g.Description, g.Privacy, groupCreated, groupCreated)
		if err != nil {
			return fmt.Errorf("insert group %s: %w", g.Title, err)
		}
		id, err := res.LastInsertId()
		if err != nil {
			return err
		}
		groupIDs[g.Title] = int(id)
	}
	log.Printf("✅ Inserted %d groups", len(groups))

	// Group Memberships
	type GroupMembership struct {
		GroupTitle string
		Username   string
		Role       string
	}
	memberships := []GroupMembership{
		{"Orbital Explorers Club", "alice", "creator"},
		{"Orbital Explorers Club", "bob", "member"},
		{"Orbital Explorers Club", "diana", "member"},
		{"Orbital Explorers Club", "elena", "member"},
		{"Orbital Explorers Club", "cosmonaut", "member"},
		{"Quantum Cosmos Research", "bob", "creator"},
		{"Quantum Cosmos Research", "alice", "member"},
		{"Quantum Cosmos Research", "grace", "member"},
		{"Quantum Cosmos Research", "elena", "member"},
		{"Quantum Cosmos Research", "cosmonaut", "member"},
		{"Astro-Photographers Guild", "charlie", "creator"},
		{"Astro-Photographers Guild", "alice", "member"},
		{"Astro-Photographers Guild", "diana", "member"},
		{"Deep Space Pioneers", "diana", "creator"},
		{"Deep Space Pioneers", "alice", "member"},
		{"Deep Space Pioneers", "frank", "member"},
		{"Zero-G Habitat Architects", "frank", "creator"},
		{"Zero-G Habitat Architects", "bob", "member"},
		{"Zero-G Habitat Architects", "grace", "member"},
	}

	memberStmt, err := tx.Prepare(`
		INSERT INTO group_members (group_id, user_id, role, joined_at)
		VALUES (?, ?, ?, ?)
	`)
	if err != nil {
		return fmt.Errorf("prepare insert group member: %w", err)
	}
	defer memberStmt.Close()

	for _, m := range memberships {
		gID := groupIDs[m.GroupTitle]
		uID := userIDs[m.Username]
		if _, err := memberStmt.Exec(gID, uID, m.Role, now.Add(-15*24*time.Hour)); err != nil {
			return fmt.Errorf("insert group member %s in %s: %w", m.Username, m.GroupTitle, err)
		}
	}
	log.Printf("✅ Inserted %d group memberships", len(memberships))

	// Group join requests & invitations
	joinRequests := []struct {
		GroupTitle string
		Username   string
		Status     string
	}{
		{"Deep Space Pioneers", "bob", "pending"},
		{"Deep Space Pioneers", "elena", "pending"},
		{"Deep Space Pioneers", "cosmonaut", "accepted"},
	}
	joinReqStmt, err := tx.Prepare(`
		INSERT INTO group_join_requests (group_id, user_id, status, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?)
	`)
	if err != nil {
		return fmt.Errorf("prepare insert group join request: %w", err)
	}
	defer joinReqStmt.Close()

	for _, jr := range joinRequests {
		gID := groupIDs[jr.GroupTitle]
		uID := userIDs[jr.Username]
		t := now.Add(-3 * 24 * time.Hour)
		if _, err := joinReqStmt.Exec(gID, uID, jr.Status, t, t); err != nil {
			return fmt.Errorf("insert group join request: %w", err)
		}
	}

	invitations := []struct {
		GroupTitle string
		InvitedBy  string
		Invited    string
		Status     string
	}{
		{"Orbital Explorers Club", "alice", "grace", "pending"},
		{"Quantum Cosmos Research", "bob", "charlie", "pending"},
	}
	invStmt, err := tx.Prepare(`
		INSERT INTO group_invitations (group_id, invited_by, invited_user_id, status, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return fmt.Errorf("prepare insert group invitation: %w", err)
	}
	defer invStmt.Close()

	for _, inv := range invitations {
		gID := groupIDs[inv.GroupTitle]
		byID := userIDs[inv.InvitedBy]
		toID := userIDs[inv.Invited]
		t := now.Add(-2 * 24 * time.Hour)
		if _, err := invStmt.Exec(gID, byID, toID, inv.Status, t, t); err != nil {
			return fmt.Errorf("insert group invitation: %w", err)
		}
	}

	events := []EventSeed{
		{
			GroupTitle:      "Orbital Explorers Club",
			CreatorUsername: "alice",
			Title:           "Perseid Meteor Shower Observation Night",
			Description:     "Bring your wide-angle lenses and dark-sky filters! We will be logging meteor frequency and radio forward scatter signals starting at 21:00 UTC.",
			EventOffset:     48 * time.Hour, // 2 days in future
		},
		{
			GroupTitle:      "Quantum Cosmos Research",
			CreatorUsername: "bob",
			Title:           "Deep Space Quantum Telemetry Symposium",
			Description:     "Virtual symposium discussing quantum key distribution via low-earth orbit constellations. Guest speaker on laser polarization fidelity.",
			EventOffset:     120 * time.Hour, // 5 days in future
		},
		{
			GroupTitle:      "Astro-Photographers Guild",
			CreatorUsername: "charlie",
			Title:           "Narrowband Nebula Processing Masterclass",
			Description:     "Live demonstration of PixInsight workflows: StarNet star removal, Generalized Hyperbolic Stretch, and Hubble Palette (SHO) color mapping.",
			EventOffset:     168 * time.Hour, // 1 week in future
		},
		{
			GroupTitle:      "Orbital Explorers Club",
			CreatorUsername: "diana",
			Title:           "Solar Flare Scintillation Field Study",
			Description:     "Field measurements of ionospheric disturbances caused by the recent solar storm. Analyzing GPS signal degradation.",
			EventOffset:     72 * time.Hour, // 3 days in future
		},
	}

	eventIDs := make(map[string]int)
	eventStmt, err := tx.Prepare(`
		INSERT INTO events (group_id, created_by, title, description, event_time, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return fmt.Errorf("prepare insert event: %w", err)
	}
	defer eventStmt.Close()

	for _, e := range events {
		gID := groupIDs[e.GroupTitle]
		cID := userIDs[e.CreatorUsername]
		eventTime := now.Add(e.EventOffset)
		created := now.Add(-5 * 24 * time.Hour)
		res, err := eventStmt.Exec(gID, cID, e.Title, e.Description, eventTime, created, created)
		if err != nil {
			return fmt.Errorf("insert event %s: %w", e.Title, err)
		}
		id, err := res.LastInsertId()
		if err != nil {
			return err
		}
		eventIDs[e.Title] = int(id)
	}
	log.Printf("✅ Inserted %d group events", len(events))

	// Event Responses
	type EventResponseSeed struct {
		EventTitle string
		Username   string
		Response   string
	}
	eventResponses := []EventResponseSeed{
		{"Perseid Meteor Shower Observation Night", "alice", "going"},
		{"Perseid Meteor Shower Observation Night", "bob", "going"},
		{"Perseid Meteor Shower Observation Night", "diana", "going"},
		{"Perseid Meteor Shower Observation Night", "elena", "not_going"},
		{"Perseid Meteor Shower Observation Night", "cosmonaut", "going"},
		{"Deep Space Quantum Telemetry Symposium", "bob", "going"},
		{"Deep Space Quantum Telemetry Symposium", "alice", "going"},
		{"Deep Space Quantum Telemetry Symposium", "grace", "going"},
		{"Narrowband Nebula Processing Masterclass", "charlie", "going"},
		{"Narrowband Nebula Processing Masterclass", "alice", "going"},
		{"Narrowband Nebula Processing Masterclass", "diana", "going"},
	}

	eventRespStmt, err := tx.Prepare(`
		INSERT INTO event_responses (event_id, user_id, response, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?)
	`)
	if err != nil {
		return fmt.Errorf("prepare insert event response: %w", err)
	}
	defer eventRespStmt.Close()

	for _, er := range eventResponses {
		eID := eventIDs[er.EventTitle]
		uID := userIDs[er.Username]
		t := now.Add(-2 * 24 * time.Hour)
		if _, err := eventRespStmt.Exec(eID, uID, er.Response, t, t); err != nil {
			return fmt.Errorf("insert event response: %w", err)
		}
	}
	log.Printf("✅ Inserted %d event responses", len(eventResponses))

	posts := []PostSeed{
		{
			AuthorUsername: "alice",
			Title:          "First High-Res Images from the Lunar Far Side",
			Content:        "The telemetry stream just arrived from the Daedalus relay station! Surface albedo in the highlands is approximately 14% higher than expected, pointing to fresh anorthositic ejecta from a geologically recent impact. Analyzing the multi-spectral bands now—the silicate absorption signatures are remarkably crisp. What an incredible milestone for the lunar survey team! 🌕✨",
			Visibility:     "public",
			CreatedOffset:  -4 * 24 * time.Hour,
		},
		{
			AuthorUsername: "bob",
			Title:          "Breakthrough in Xenon Ion Thruster Efficiency",
			Content:        "We just finished a 72-hour continuous vacuum test on our new Hall-effect thruster prototype. By optimizing the magnetic cusp topology, we reduced channel erosion by nearly 35% while sustaining a specific impulse of 3,200 seconds! This could reduce transit times to Mars by up to 40 days for unmanned cargo payloads. Full whitepaper coming next week! 🚀",
			Visibility:     "public",
			CreatedOffset:  -3 * 24 * time.Hour,
		},
		{
			AuthorUsername: "charlie",
			Title:          "NGC 7000: North America Nebula in SHO Palette",
			Content:        "Captured over 3 clear nights in the desert: 18 hours of total integration time (6h Ha, 6h OIII, 6h SII) using the cooled monochrome sensor at -15°C. The Cygnus Wall pillar structures stand out with immense depth. Exclusive early look for my followers before submitting to the astrophotography competition! 🔭🌌",
			Visibility:     "followers",
			CreatedOffset:  -2 * 24 * time.Hour,
		},
		{
			AuthorUsername: "diana",
			Title:          "Microgravity Hydroponics: Day 45 Growth Log",
			Content:        "Our orbital brassica crops have reached full vegetative maturity under 450nm/660nm LED spectra. Interestingly, without gravity-induced convection, boundary layer transpiration required a 20% increase in laminar airflow to prevent leaf tip burn. Biomass yield is tracking 92% of Earth terrestrial controls! 🥬🌱",
			Visibility:     "public",
			CreatedOffset:  -36 * time.Hour,
		},
		{
			AuthorUsername: "elena",
			Title:          "Meteorite Spectrometry: Chondrite Sample Analysis",
			Content:        "Laboratory analysis of the Atacama desert recovery is complete. Olivine and pyroxene ratios classify this as an L6 ordinary chondrite with intense shock veins from an ancient parent-body collision ~470 million years ago. Cosmic ray exposure dating indicates a 12-million-year transit time before landing on Earth. 🪐💎",
			Visibility:     "public",
			CreatedOffset:  -24 * time.Hour,
		},
		{
			AuthorUsername: "grace",
			Title:          "Solar Storm Watch: Geo-Magnetic Kp Index at 7+",
			Content:        "Active Region 3664 has just released an M8.4 coronal mass ejection directed along the Earth-Sun line. Expect geomagnetic storm conditions within the next 24 to 36 hours. Auroral oval is predicted to expand southward toward 45° magnetic latitude. Keep your cameras ready and satellite dishes calibrated! ⚡📡",
			Visibility:     "public",
			CreatedOffset:  -12 * time.Hour,
		},
		{
			AuthorUsername: "alice",
			Title:          "Preliminary Orbital Flight Trajectory Report",
			Content:        "Draft calculations for the upcoming Molniya constellation repositioning. Sharing with selected telemetry specialists for peer review prior to mission control submission.",
			Visibility:     "custom",
			AllowedViewers: []string{"bob", "grace", "cosmonaut"},
			CreatedOffset:  -6 * time.Hour,
		},
		// Group Posts
		{
			AuthorUsername: "alice",
			GroupTitle:     "Orbital Explorers Club",
			Title:          "Welcome to the Orbital Telemetry Frequency!",
			Content:        "We have established this group channel to share real-time pass predictions, Keplerian two-line element (TLE) sets, and ground station logs. Feel free to introduce your setups and current observation targets below! 🛰️",
			Visibility:     "public",
			CreatedOffset:  -5 * 24 * time.Hour,
		},
		{
			AuthorUsername: "bob",
			GroupTitle:     "Orbital Explorers Club",
			Title:          "Doppler Shift Tracking of Low Earth Orbit Satellites",
			Content:        "Anyone else noticing slight frequency offsets on the 437 MHz beacon downlink during southern horizon passes? I'm running an automated SDR script to log the S-curve.",
			Visibility:     "public",
			CreatedOffset:  -2 * 24 * time.Hour,
		},
		{
			AuthorUsername: "bob",
			GroupTitle:     "Quantum Cosmos Research",
			Title:          "Entanglement Distribution Over Satellite Laser Downlinks",
			Content:        "Reviewing the latest findings on atmospheric turbulence mitigation using adaptive optics for ground-to-space quantum key distribution. Photon loss dropped by 12 dB in the recent Tenerife trials.",
			Visibility:     "public",
			CreatedOffset:  -4 * 24 * time.Hour,
		},
		{
			AuthorUsername: "charlie",
			GroupTitle:     "Astro-Photographers Guild",
			Title:          "Collimating RC and SCT Telescopes with Artificial Stars",
			Content:        "Quick tip for anyone struggling with star bloat: Use a 50-micron artificial star placed at least 30 focal lengths away to achieve sub-arcsecond collimation before sunset.",
			Visibility:     "public",
			CreatedOffset:  -3 * 24 * time.Hour,
		},
	}

	postIDs := make(map[string]int)
	postStmt, err := tx.Prepare(`
		INSERT INTO posts (user_id, title, content, visibility, group_id, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return fmt.Errorf("prepare insert post: %w", err)
	}
	defer postStmt.Close()

	allowedViewerStmt, err := tx.Prepare(`
		INSERT INTO post_allowed_viewers (post_id, user_id, created_at)
		VALUES (?, ?, ?)
	`)
	if err != nil {
		return fmt.Errorf("prepare insert post_allowed_viewers: %w", err)
	}
	defer allowedViewerStmt.Close()

	for _, p := range posts {
		authorID := userIDs[p.AuthorUsername]
		postCreated := now.Add(p.CreatedOffset)

		var groupID sql.NullInt64
		if p.GroupTitle != "" {
			groupID = sql.NullInt64{Int64: int64(groupIDs[p.GroupTitle]), Valid: true}
		}

		res, err := postStmt.Exec(authorID, p.Title, p.Content, p.Visibility, groupID, postCreated, postCreated)
		if err != nil {
			return fmt.Errorf("insert post %s: %w", p.Title, err)
		}
		pID, err := res.LastInsertId()
		if err != nil {
			return err
		}
		postIDs[p.Title] = int(pID)

		if p.Visibility == "custom" && len(p.AllowedViewers) > 0 {
			for _, viewerUsername := range p.AllowedViewers {
				vID := userIDs[viewerUsername]
				if _, err := allowedViewerStmt.Exec(pID, vID, postCreated); err != nil {
					return fmt.Errorf("insert allowed viewer %s for post %d: %w", viewerUsername, pID, err)
				}
			}
		}
	}
	log.Printf("✅ Inserted %d posts (including group and custom visibility posts)", len(posts))

	comments := []CommentSeed{
		{
			AuthorUsername: "bob",
			PostTitle:      "First High-Res Images from the Lunar Far Side",
			Content:        "Incredible resolution! Was this processed with lucky imaging deconvolution or wavelets?",
			CreatedOffset:  -3 * 24 * time.Hour,
		},
		{
			AuthorUsername: "alice",
			PostTitle:      "First High-Res Images from the Lunar Far Side",
			Content:        "@bob We stacked the top 5% of 10,000 frames using Richardson-Lucy deconvolution on the high-gain telemetry sensor.",
			CreatedOffset:  -68 * time.Hour,
		},
		{
			AuthorUsername: "diana",
			PostTitle:      "First High-Res Images from the Lunar Far Side",
			Content:        "The mineral distribution in the northern caldera looks very promising for volatiles. Great work Alice!",
			CreatedOffset:  -48 * time.Hour,
		},
		{
			AuthorUsername: "elena",
			PostTitle:      "First High-Res Images from the Lunar Far Side",
			Content:        "Those highland albedo variations perfectly match our lunar basalt core sample reflectance profiles.",
			CreatedOffset:  -40 * time.Hour,
		},
		{
			AuthorUsername: "grace",
			PostTitle:      "Breakthrough in Xenon Ion Thruster Efficiency",
			Content:        "3,200 seconds specific impulse is phenomenal Bob! What was the grid voltage and mass flow rate during peak thrust?",
			CreatedOffset:  -50 * time.Hour,
		},
		{
			AuthorUsername: "bob",
			PostTitle:      "Breakthrough in Xenon Ion Thruster Efficiency",
			Content:        "@grace We held the screen grid at 1,400V with a xenon flow rate of 2.1 mg/s. Stability was flawless throughout the 72h burn.",
			CreatedOffset:  -44 * time.Hour,
		},
		{
			AuthorUsername: "alice",
			PostTitle:      "Breakthrough in Xenon Ion Thruster Efficiency",
			Content:        "This is going to revolutionize cargo payloads for the lunar gateway. Kudos to the propulsion team!",
			CreatedOffset:  -30 * time.Hour,
		},
		{
			AuthorUsername: "alice",
			PostTitle:      "Microgravity Hydroponics: Day 45 Growth Log",
			Content:        "Are you noticing any root system geotropism disorientation, or does the nutrient film capillary action compensate?",
			CreatedOffset:  -20 * time.Hour,
		},
		{
			AuthorUsername: "diana",
			PostTitle:      "Microgravity Hydroponics: Day 45 Growth Log",
			Content:        "@alice The capillary mesh keeps root orientation remarkably uniform! Nutrient uptake is very steady.",
			CreatedOffset:  -15 * time.Hour,
		},
		{
			AuthorUsername: "bob",
			PostTitle:      "Welcome to the Orbital Telemetry Frequency!",
			Content:        "Glad to be here! Setting up a dual-axis azimuth/elevation rotor on my roof this weekend.",
			CreatedOffset:  -4 * 24 * time.Hour,
		},
		{
			AuthorUsername: "diana",
			PostTitle:      "Welcome to the Orbital Telemetry Frequency!",
			Content:        "Excited for the upcoming passes! Looking forward to tomorrow's observation event.",
			CreatedOffset:  -3 * 24 * time.Hour,
		},
		{
			AuthorUsername: "cosmonaut",
			PostTitle:      "Welcome to the Orbital Telemetry Frequency!",
			Content:        "Happy to join the telemetry network! Tracking from station Alpha.",
			CreatedOffset:  -2 * 24 * time.Hour,
		},
	}

	commentStmt, err := tx.Prepare(`
		INSERT INTO comments (post_id, user_id, content, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?)
	`)
	if err != nil {
		return fmt.Errorf("prepare insert comment: %w", err)
	}
	defer commentStmt.Close()

	for _, c := range comments {
		pID := postIDs[c.PostTitle]
		uID := userIDs[c.AuthorUsername]
		cTime := now.Add(c.CreatedOffset)
		if _, err := commentStmt.Exec(pID, uID, c.Content, cTime, cTime); err != nil {
			return fmt.Errorf("insert comment on %s: %w", c.PostTitle, err)
		}
	}
	log.Printf("✅ Inserted %d comments", len(comments))

	privateMessages := []PrivateMessageSeed{
		{"bob", "alice", "Hey Alice, did you see the telemetry readout from the Daedalus relay?", true, -2 * 24 * time.Hour},
		{"alice", "bob", "Hey Bob! Yes, I was just looking at Crater Daedalus. The surface reflectivity is higher than expected.", true, -47 * time.Hour},
		{"bob", "alice", "That matches our spectroscopy models from last week. Let's compare notes tomorrow.", true, -46 * time.Hour},
		{"alice", "bob", "Sounds great! I'll prepare the charts.", true, -40 * time.Hour},
		{"bob", "alice", "Awesome, talk to you then! 🚀", true, -38 * time.Hour},
		{"alice", "bob", "See you at the mission briefing.", false, -10 * time.Minute},

		{"diana", "alice", "Alice, how is the sensor calibration holding up in the orbital lab?", true, -30 * time.Hour},
		{"alice", "diana", "Calibration is rock solid. The thermal shielding is performing well within margins.", true, -28 * time.Hour},
		{"diana", "alice", "Wonderful! Let me know when the next spectral run completes.", true, -25 * time.Hour},
		{"alice", "diana", "Will do Diana! Sending the raw telemetry now.", false, -1 * time.Hour},

		{"elena", "bob", "Bob, could you share the raw dataset from the solar array telemetry?", true, -20 * time.Hour},
		{"bob", "elena", "Sending over the parquet files now. Check your frequency relay.", true, -18 * time.Hour},
		{"elena", "bob", "Received! The solar flux numbers look very promising.", true, -16 * time.Hour},

		{"cosmonaut", "alice", "Greetings Alice! Glad to connect on the orbital network.", true, -15 * time.Hour},
		{"alice", "cosmonaut", "Welcome aboard Cosmonaut! Let me know if you need any help navigating the telemetry frequencies.", true, -14 * time.Hour},
		{"cosmonaut", "alice", "Will do! Looking forward to the Perseid meteor observation night.", false, -2 * time.Hour},

		{"cosmonaut", "bob", "Hey Bob, impressed by the ion propulsion data you posted.", true, -10 * time.Hour},
		{"bob", "cosmonaut", "Thanks! We've been working on those magnetic cusps for months. Glad the results are panning out.", false, -30 * time.Minute},
	}

	pmStmt, err := tx.Prepare(`
		INSERT INTO private_messages (sender_id, recipient_id, content, read_at, created_at)
		VALUES (?, ?, ?, ?, ?)
	`)
	if err != nil {
		return fmt.Errorf("prepare insert private message: %w", err)
	}
	defer pmStmt.Close()

	for _, pm := range privateMessages {
		sID := userIDs[pm.SenderUsername]
		rID := userIDs[pm.RecipientUsername]
		pmCreated := now.Add(pm.CreatedOffset)

		var readAt sql.NullTime
		if pm.Read {
			readAt = sql.NullTime{Time: pmCreated.Add(5 * time.Minute), Valid: true}
		}

		if _, err := pmStmt.Exec(sID, rID, pm.Content, readAt, pmCreated); err != nil {
			return fmt.Errorf("insert private message %s -> %s: %w", pm.SenderUsername, pm.RecipientUsername, err)
		}
	}
	log.Printf("✅ Inserted %d private direct messages", len(privateMessages))

	groupMessages := []GroupMessageSeed{
		{"Orbital Explorers Club", "alice", "Welcome everyone to the orbital frequency channel! 🛰️", -3 * 24 * time.Hour},
		{"Orbital Explorers Club", "bob", "Excited to be here. Orbit calculations look solid.", -2 * 24 * time.Hour},
		{"Orbital Explorers Club", "diana", "Looking forward to tomorrow's lunar observation party!", -1 * 24 * time.Hour},
		{"Orbital Explorers Club", "elena", "I'll bring the spectrometer analysis data.", -12 * time.Hour},
		{"Orbital Explorers Club", "cosmonaut", "Ground station ready for uplink.", -2 * time.Hour},

		{"Quantum Cosmos Research", "bob", "Starting the quantum entanglement discussion thread here.", -2 * 24 * time.Hour},
		{"Quantum Cosmos Research", "grace", "Monitoring satellite link latency now.", -20 * time.Hour},
		{"Quantum Cosmos Research", "alice", "Quantum key generation rate is exceeding expectations.", -6 * time.Hour},
	}

	gmStmt, err := tx.Prepare(`
		INSERT INTO group_messages (group_id, user_id, content, created_at)
		VALUES (?, ?, ?, ?)
	`)
	if err != nil {
		return fmt.Errorf("prepare insert group message: %w", err)
	}
	defer gmStmt.Close()

	for _, gm := range groupMessages {
		gID := groupIDs[gm.GroupTitle]
		uID := userIDs[gm.AuthorUsername]
		gmCreated := now.Add(gm.CreatedOffset)
		if _, err := gmStmt.Exec(gID, uID, gm.Content, gmCreated); err != nil {
			return fmt.Errorf("insert group message in %s: %w", gm.GroupTitle, err)
		}
	}
	log.Printf("✅ Inserted %d group chat messages", len(groupMessages))

	type NotificationSeed struct {
		ReceiverUsername string
		ActorUsername    string
		Type             string
		EntityType       string
		EntityID         int
		Message          string
		Read             bool
		CreatedOffset    time.Duration
	}

	notifications := []NotificationSeed{
		{
			ReceiverUsername: "alice",
			ActorUsername:    "bob",
			Type:             "new_follower",
			EntityType:       "follow",
			Message:          "Bob Vance started following you.",
			Read:             true,
			CreatedOffset:    -24 * time.Hour,
		},
		{
			ReceiverUsername: "alice",
			ActorUsername:    "diana",
			Type:             "new_follower",
			EntityType:       "follow",
			Message:          "Diana Prince started following you.",
			Read:             true,
			CreatedOffset:    -18 * time.Hour,
		},
		{
			ReceiverUsername: "alice",
			ActorUsername:    "cosmonaut",
			Type:             "new_follower",
			EntityType:       "follow",
			Message:          "Cosmo Naut started following you.",
			Read:             false,
			CreatedOffset:    -2 * time.Hour,
		},
		{
			ReceiverUsername: "bob",
			ActorUsername:    "alice",
			Type:             "new_follower",
			EntityType:       "follow",
			Message:          "Alice Walker started following you.",
			Read:             true,
			CreatedOffset:    -24 * time.Hour,
		},
		{
			ReceiverUsername: "charlie",
			ActorUsername:    "elena",
			Type:             "follow_request",
			EntityType:       "follow_request",
			Message:          "Elena Rostova requested to follow your private profile.",
			Read:             false,
			CreatedOffset:    -5 * time.Hour,
		},
		{
			ReceiverUsername: "cosmonaut",
			ActorUsername:    "alice",
			Type:             "group_invitation",
			EntityType:       "group_invitation",
			EntityID:         groupIDs["Orbital Explorers Club"],
			Message:          "Alice Walker invited you to join Orbital Explorers Club.",
			Read:             false,
			CreatedOffset:    -3 * time.Hour,
		},
	}

	notifStmt, err := tx.Prepare(`
		INSERT INTO notifications (receiver_id, actor_id, type, entity_type, entity_id, message, read_at, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return fmt.Errorf("prepare insert notification: %w", err)
	}
	defer notifStmt.Close()

	for _, n := range notifications {
		recID := userIDs[n.ReceiverUsername]
		var actID sql.NullInt64
		if n.ActorUsername != "" {
			actID = sql.NullInt64{Int64: int64(userIDs[n.ActorUsername]), Valid: true}
		}
		var entType sql.NullString
		if n.EntityType != "" {
			entType = sql.NullString{String: n.EntityType, Valid: true}
		}
		var entID sql.NullInt64
		if n.EntityID != 0 {
			entID = sql.NullInt64{Int64: int64(n.EntityID), Valid: true}
		}
		nCreated := now.Add(n.CreatedOffset)
		var readAt sql.NullTime
		if n.Read {
			readAt = sql.NullTime{Time: nCreated.Add(10 * time.Minute), Valid: true}
		}

		if _, err := notifStmt.Exec(recID, actID, n.Type, entType, entID, n.Message, readAt, nCreated); err != nil {
			return fmt.Errorf("insert notification for %s: %w", n.ReceiverUsername, err)
		}
	}
	log.Printf("✅ Inserted %d sample notifications", len(notifications))

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit seed transaction: %w", err)
	}

	log.Println("🎉 Database successfully seeded with rich sample data!")
	return nil
}

func truncateAll(db *sql.DB) error {
	tables := []string{
		"notifications",
		"group_messages",
		"private_messages",
		"event_responses",
		"events",
		"comments",
		"post_media",
		"post_allowed_viewers",
		"posts",
		"group_join_requests",
		"group_invitations",
		"group_members",
		"groups",
		"follow_requests",
		"followers",
		"sessions",
		"users",
	}

	if _, err := db.Exec("PRAGMA foreign_keys = OFF;"); err != nil {
		return err
	}
	defer db.Exec("PRAGMA foreign_keys = ON;")

	for _, t := range tables {
		if _, err := db.Exec(fmt.Sprintf("DELETE FROM %s;", t)); err != nil {
			return fmt.Errorf("delete from %s: %w", t, err)
		}
	}

	// Reset autoincrement primary keys so IDs predictably start from 1
	db.Exec("DELETE FROM sqlite_sequence;")

	return nil
}
