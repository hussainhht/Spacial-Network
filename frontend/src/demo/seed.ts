import type { Post } from "@/features/posts/types/post";
import type { Comment } from "@/features/comments/types/comment";
import type { ApiGroup, ApiEvent } from "@/features/groups/types/api";
import type { PrivateMessage } from "@/features/chat/types/chat";
import type {
  GroupMessagePayload,
  NotificationEventPayload,
} from "@/lib/websocket/types";
import { assetPath } from "./config";

export const SEED_DATE = "2026-10-27T12:00:00.000Z";
export interface DemoUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  profile_photo: string;
  is_private: boolean;
  about_me: string;
  nickname: string;
  date_of_birth: string;
  email: string;
}
const identities = [
  [
    "Nova",
    "Reed",
    "nova",
    "Building interfaces by day, finding constellations by night.",
  ],
  [
    "Orion",
    "Vale",
    "orion",
    "Astronomy student. Keeper of the campus telescope.",
  ],
  [
    "Mira",
    "Chen",
    "mira",
    "Robotics, embedded systems, and small experiments that make a difference.",
  ],
  ["Leo", "Brooks", "leo", "Game developer exploring procedural worlds."],
  [
    "Aria",
    "Stone",
    "aria",
    "Private orbit. Design sketches and campus stories for friends.",
  ],
  ["Ezra", "Park", "ezra", "Learning Go, one well-tested handler at a time."],
  ["Luna", "Hayes", "luna", "Astrophotography and weekend walks."],
  ["Kai", "Morgan", "kai", "Organizing our university's next hackathon."],
  ["Iris", "Lane", "iris", "Accessibility is part of good design."],
  ["Atlas", "Cole", "atlas", "Open-source enthusiast and Linux explorer."],
  ["Sage", "Rivera", "sage", "Coffee, circuits, and curiosity."],
  ["Finn", "Ellis", "finn", "Music producer learning creative coding."],
  ["Lyra", "Quinn", "lyra", "Collecting ideas for a more sustainable campus."],
  [
    "Theo",
    "Blake",
    "theo",
    "Interested in networks, distributed systems, and the night sky.",
  ],
  ["Ada", "Wells", "ada", "Mathematics student and puzzle club member."],
  ["Sol", "Avery", "sol", "Solar energy research and science communication."],
];
export const DEMO_USERS: DemoUser[] = identities.map(
  ([first_name, last_name, username, about_me], i) => ({
    id: i + 1,
    username,
    first_name,
    last_name,
    about_me,
    profile_photo: assetPath(`/demo/avatars/${i + 1}.svg`),
    is_private: i === 4 || i === 10,
    nickname: first_name,
    date_of_birth: "2002-04-12",
    email: `${username}@example.invalid`,
  }),
);
export const DEMO_GROUPS: ApiGroup[] = [
  [
    "Orbital Observatory",
    "A friendly place to learn the night sky. Telescope sessions, observing notes, and astrophotography.",
    "public",
  ],
  [
    "Code & Coffee",
    "Build together. Share TypeScript, Go, and open-source discoveries.",
    "public",
  ],
  [
    "Robotics Lab",
    "Sensors, control loops, and our university rover project.",
    "public",
  ],
  [
    "Pixel Pioneers",
    "Indie game development, playtesting, and creative coding.",
    "public",
  ],
  [
    "Campus Collective",
    "Student-led activities, study meetups, and sustainable campus projects.",
    "public",
  ],
  [
    "Future Systems",
    "A reading circle for distributed systems and emerging technology.",
    "public",
  ],
  [
    "Design Orbit",
    "An invitation-only studio for constructive design feedback.",
    "private",
  ],
  [
    "Mission Control",
    "Private planning space for the exhibition team.",
    "private",
  ],
].map(([title, description, privacy], i) => ({
  id: i + 1,
  creator_id: i === 0 ? 1 : i + 1,
  title,
  description,
  privacy: privacy as ApiGroup["privacy"],
  group_photo: assetPath(
    `/image/templets/${["earth", "mars", "moon", "saturn"][i % 4]}.png`,
  ),
  created_at: SEED_DATE,
  updated_at: SEED_DATE,
  creator_username: DEMO_USERS[i].username,
  member_count: 0,
  has_pending_join_request: false,
  has_pending_invitation: false,
}));
const stories = [
  [
    "A small network, a whole universe",
    "Welcome to our shared orbit. What are you building this week? I am connecting the last pieces of our university exhibition demo.",
  ],
  [
    "Tonight's observing notes",
    "The best part of astronomy club is the moment someone sees Saturn's rings for the first time. Bring a notebook to our next session.",
  ],
  [
    "The rover finally navigates on its own",
    "We tuned the obstacle avoidance loop and tested it in the lab. The next challenge is making it work on uneven terrain.",
  ],
  [
    "From a sketch to a playable world",
    "A weekend prototype became a tiny exploration game. Procedural terrain is fun, but good movement makes the world feel alive.",
  ],
  [
    "Making room for quiet design",
    "Working on a reading interface with fewer distractions. Good spacing is doing more work than another animation ever could.",
  ],
  [
    "A lesson from writing Go handlers",
    "Returning a useful error is part of the API design. My tests caught an authorization edge case before it reached the interface.",
  ],
  [
    "The patience behind a star trail",
    "Ninety exposures, one thermos of tea, and a very still tripod. Sometimes the most useful photography tool is patience.",
  ],
  [
    "Hackathon teams are forming",
    "You do not need a finished idea to join. Bring a question, a skill you want to learn, or just the willingness to try something new.",
  ],
  [
    "Keyboard-first testing",
    "Try putting your mouse aside for ten minutes. Focus order and visible focus rings tell you a lot about an interface.",
  ],
  [
    "My first open-source contribution",
    "A documentation fix became a conversation with a maintainer. Small contributions count, and clear reproduction steps help everyone.",
  ],
  [
    "What a sensor actually measures",
    "We compared three temperature sensors against the same reference. Calibration matters more than the number of decimal places.",
  ],
  [
    "Turning an orbit into a rhythm",
    "Mapped a simple orbital simulation to a synthesizer. Creative coding is a lovely meeting point between music and mathematics.",
  ],
  [
    "Repair before replace",
    "Our campus repair table saved two keyboards and a lamp today. Next time we are bringing a soldering station.",
  ],
  [
    "When a message arrives twice",
    "Thinking about idempotency in chat systems. Reliable interfaces need to account for retries, delayed receipts, and reconnects.",
  ],
  [
    "A puzzle for the walk home",
    "How many connections can sixteen people make if everyone meets everyone once? Graph theory has a habit of appearing everywhere.",
  ],
  [
    "A brighter energy experiment",
    "We logged a week of output from the small rooftop solar rig. Shade patterns are much more interesting than our first model assumed.",
  ],
  [
    "Exhibition checklist is ready",
    "Working navigation, readable text, useful empty states, and a graceful fallback. The best demos let visitors explore at their own pace.",
  ],
  [
    "Looking up together",
    "A reminder that a beginner question is welcome at every telescope session. Curiosity is the only prerequisite.",
  ],
  [
    "A robot that explains its decisions",
    "Added a simple visualization of the rover's distance readings. Debugging becomes easier when you can see what the system sees.",
  ],
  [
    "Playtesting with fresh eyes",
    "Watching someone else play your game reveals assumptions you stopped noticing. Today we simplified the tutorial.",
  ],
  [
    "Behind the studio door",
    "Sharing an early typography study with my followers. Still deciding how much contrast the secondary labels need.",
  ],
  [
    "Keep state close to its owner",
    "Spent the afternoon untangling a shared cache. Clear ownership made the refresh behavior much easier to understand.",
  ],
  [
    "Cloudy skies, good company",
    "Our observing session became an impromptu workshop on reading star charts. A cloudy night can still be a useful night.",
  ],
  [
    "A place for first-time builders",
    "We reserved a beginner table at the next workshop. Come with your laptop and we will help you get your first project running.",
  ],
  [
    "Accessible motion",
    "A reduced-motion preference should change how an experience moves while keeping its meaning and personality.",
  ],
  [
    "Notes from the Linux workshop",
    "We practiced safe shell habits, useful logs, and how to ask a good debugging question. Notes are ready for the next meetup.",
  ],
  [
    "Campus circuit challenge",
    "Can we design an indicator light that runs all week on the smallest battery? Sketches welcome in Robotics Lab.",
  ],
  [
    "Sound design for tiny worlds",
    "A few quiet ambient sounds changed the feel of the prototype more than a new texture did.",
  ],
  [
    "Sharing the tools we already have",
    "Our student tool library is taking shape. Borrowing a multimeter should be as easy as borrowing a book.",
  ],
  [
    "The network is a conversation",
    "A useful system helps people understand what happened, what is happening, and what they can do next.",
  ],
  [
    "Math circle next week",
    "We are exploring paths, cycles, and the shortest route through a map. Bring a pencil and your favorite counterexample.",
  ],
  [
    "Science needs good explanations",
    "Preparing a poster about solar cells for the exhibition. Testing the explanation with a friend helped more than another paragraph.",
  ],
];
export interface DemoState {
  version: 1;
  currentUserId: number;
  nextId: number;
  users: DemoUser[];
  posts: Post[];
  comments: Comment[];
  groups: ApiGroup[];
  events: ApiEvent[];
  follows: [number, number][];
  followRequests: { id: number; from: number; to: number }[];
  memberships: { groupId: number; userId: number; role: string }[];
  invitations: { id: number; groupId: number; from: number; to: number }[];
  joinRequests: { id: number; groupId: number; userId: number }[];
  likes: Record<string, number[]>;
  rsvps: Record<string, Record<string, "going" | "not_going">>;
  messages: PrivateMessage[];
  groupMessages: GroupMessagePayload[];
  notifications: (NotificationEventPayload & { userId: number })[];
}
const replies = [
  [
    "I am polishing the rover dashboard. Could we try the projects together before the exhibition?",
    "The astronomy table is ready. I can help welcome visitors who are new to the project.",
  ],
  [
    "Can we start with learning to align the telescope? I have never used an equatorial mount.",
    "Absolutely. We will begin with setup while there is still daylight and pair up for observing.",
  ],
  [
    "Did changing the sampling interval help with the noisy readings?",
    "Yes. Averaging a short window made the controller more stable without too much delay.",
  ],
  [
    "The exploration prototype sounds fun. I would be happy to playtest the controls.",
    "Please do. I am especially interested in whether the camera feels comfortable.",
  ],
  [
    "I like the idea of a quieter interface. Have you tried a slightly wider line spacing?",
    "That is the next comparison. I also want to test how it feels on a small screen.",
  ],
  [
    "Would a table-driven test make those error cases easier to keep together?",
    "Good suggestion. I added cases for missing sessions, wrong ownership, and invalid input.",
  ],
  [
    "Did you use an intervalometer, or is the camera controlling the exposures?",
    "The camera handled the sequence. I checked the framing twice before starting the long capture.",
  ],
  [
    "Could a first-time participant join without knowing which team to pick?",
    "Of course. We will have a short matching session and a beginner-friendly project table.",
  ],
  [
    "Testing the focus order caught a dialog that I could open but could not close.",
    "That is a useful catch. Escape handling and returning focus to the trigger make a big difference.",
  ],
  [
    "Writing a clear issue is a contribution too. The reproduction made the fix straightforward.",
    "The maintainer said the same thing. I will keep including a minimal example with bug reports.",
  ],
  [
    "We can borrow the lab reference sensor for another comparison next week.",
    "That would help. Let's record the ambient conditions alongside each measurement this time.",
  ],
  [
    "Could you share how you mapped the orbital period to tempo?",
    "I scaled the period into a comfortable tempo range and used distance for the filter cutoff.",
  ],
  [
    "I can bring spare switches and a few tools to the next repair table.",
    "Thank you. A small parts organizer would also save us a lot of searching during the session.",
  ],
  [
    "A stable message ID seems essential once the client starts retrying.",
    "Exactly. We also need to merge history and incoming events without duplicating a message.",
  ],
  [
    "I drew it as a graph first. Counting each edge twice was the trap.",
    "A drawing helps. The same counting idea works for handshakes and fully connected networks.",
  ],
  [
    "Could we include the cloudy days on the poster as well as the best day?",
    "Yes. Showing the full range will explain why averages matter for the experiment.",
  ],
];
export function createSeed(): DemoState {
  const users = structuredClone(DEMO_USERS),
    groups = structuredClone(DEMO_GROUPS);
  const posts: Post[] = stories.map(([title, content], i) => ({
    id: i + 1,
    user_id: (i % 16) + 1,
    author: users[i % 16],
    title,
    content,
    visibility: i === 20 ? "followers" : "public",
    media:
      i === 1
        ? [
            {
              id: 1,
              url: assetPath("/image/templets/saturn.png"),
              type: "image",
              order: 0,
            },
          ]
        : [],
    created_at: new Date(Date.parse(SEED_DATE) - i * 3600000).toISOString(),
    updated_at: SEED_DATE,
    is_owner: false,
    can_delete: false,
    ...(i >= 24 ? { group_id: i - 23, group_title: groups[i - 24].title } : {}),
  }));
  const comments: Comment[] = posts.flatMap((p, i) =>
    [0, 1].map((j) => ({
      id: i * 2 + j + 1,
      post_id: p.id,
      user_id: ((i + j + 1) % 16) + 1,
      author: users[(i + j + 1) % 16],
      content: replies[i % 16][j],
      created_at: SEED_DATE,
      updated_at: SEED_DATE,
      is_owner: false,
      can_delete: false,
    })),
  );
  const memberships = groups.flatMap((g) =>
    Array.from(
      new Set([
        g.creator_id,
        ...users.filter((u) => (u.id + g.id) % 3 === 0).map((u) => u.id),
        ...posts.filter((p) => p.group_id === g.id).map((p) => p.user_id),
        ...(g.id <= 3 ? [1] : []),
      ]),
    ).map((userId) => ({
      groupId: g.id,
      userId,
      role: userId === g.creator_id ? "creator" : "member",
    })),
  );
  for (const comment of comments) {
    const post = posts.find((p) => p.id === comment.post_id)!;
    if (!post.group_id) continue;
    const members = memberships.filter((m) => m.groupId === post.group_id);
    const authorId = members[comment.id % members.length].userId;
    comment.user_id = authorId;
    comment.author = users[authorId - 1];
  }
  const events: ApiEvent[] = Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    group_id: (i % 8) + 1,
    created_by: groups[i % 8].creator_id,
    title: [
      "Demo skywatch evening",
      "Go API workshop",
      "Rover test session",
      "Indie game playtest",
      "Campus makers meetup",
      "Systems reading circle",
      "Studio critique",
      "Exhibition rehearsal",
      "Lunar photography workshop",
      "TypeScript clinic",
    ][i],
    description:
      "Fictional showcase event. Bring your questions and share what you are working on. Times are illustrative and this is not a real-world booking.",
    event_time: `2027-0${i < 5 ? 1 : 2}-${String(10 + i).padStart(2, "0")}T15:00:00Z`,
    created_at: SEED_DATE,
    updated_at: SEED_DATE,
    current_user_response: null,
    going_count: 0,
    not_going_count: 0,
    image_path: groups[i % 8].group_photo ?? null,
  }));
  const follows: [number, number][] = users.flatMap((u) =>
    users
      .filter((v) => v.id !== u.id && !v.is_private && (u.id + v.id) % 3 !== 0)
      .map((v) => [u.id, v.id] as [number, number]),
  );
  const messages: PrivateMessage[] = [3, 4, 6, 7, 9, 10, 12]
    .map((id) => users[id - 1])
    .flatMap((u, i) =>
      [0, 1, 2].map((j) => ({
        id: i * 3 + j + 1,
        sender_id: j === 1 ? 1 : u.id,
        recipient_id: j === 1 ? u.id : 1,
        sender_username: j === 1 ? "nova" : u.username,
        content: [
          "Are you coming to the exhibition workshop?",
          "Yes! I will bring the latest prototype.",
          "Great, let's compare notes when you arrive.",
        ][j],
        created_at: new Date(
          Date.parse(SEED_DATE) - (8 - i) * 3600000 + j * 60000,
        ).toISOString(),
        read_at: j === 1 ? SEED_DATE : undefined,
      })),
    );
  const groupMessages: GroupMessagePayload[] = groups.flatMap((g) =>
    memberships
      .filter((m) => m.groupId === g.id)
      .slice(0, 4)
      .map((m, i) => ({
        id: g.id * 10 + i,
        group_id: g.id,
        user_id: m.userId,
        username: users[m.userId - 1].username,
        content: [
          "Welcome to our shared workspace. What are you exploring this week?",
          "I have a prototype ready for feedback.",
          "Looking forward to the next workshop!",
          "I added a few notes for the event. Happy to help anyone getting started.",
        ][i],
        created_at: SEED_DATE,
      })),
  );
  const notifications: DemoState["notifications"] = users.flatMap((u) =>
    Array.from({ length: 18 }, (_, i) => ({
      id: u.id * 100 + i,
      userId: u.id,
      actor_id: ((u.id + i) % 16) + 1,
      type: [
        "new_follower",
        "post_comment",
        "post_like",
        "group_event",
        "private_message",
        "event_rsvp",
      ][i % 6],
      entity_type: i % 6 === 1 || i % 6 === 2 ? "post" : "group",
      entity_id: i % 6 === 1 || i % 6 === 2 ? 1 : (i % 8) + 1,
      message: [
        "is now following your orbit.",
        "left a thoughtful comment on a post.",
        "liked a community post.",
        "shared a new demo event.",
        "sent you a message.",
        "is going to a group event.",
      ][i % 6],
      data: {
        actor_username: users[(u.id + i) % 16].username,
        group_id: (i % 8) + 1,
        group_title: groups[i % 8].title,
      },
      read_at: i < 6 ? null : SEED_DATE,
      created_at: new Date(Date.parse(SEED_DATE) - i * 3600000).toISOString(),
    })),
  );
  notifications.unshift(
    {
      id: 9000,
      userId: 1,
      actor_id: 7,
      type: "group_invitation",
      entity_type: "group_invitation",
      entity_id: 1,
      message: "Luna Hayes invited you to Design Orbit.",
      data: {
        group_id: 7,
        group_title: groups[6].title,
        actor_username: "luna",
      },
      read_at: null,
      created_at: SEED_DATE,
    },
    {
      id: 9001,
      userId: 1,
      actor_id: 4,
      type: "group_join_request",
      entity_type: "group_join_request",
      entity_id: 1,
      message: "Leo Brooks requested to join Orbital Observatory.",
      data: {
        group_id: 1,
        group_title: groups[0].title,
        actor_username: "leo",
      },
      read_at: null,
      created_at: SEED_DATE,
    },
    {
      id: 9002,
      userId: 5,
      actor_id: 6,
      type: "follow_request",
      entity_type: "follow_request",
      entity_id: 1,
      message: "Ezra Park requested to follow your private orbit.",
      data: { actor_username: "ezra" },
      read_at: null,
      created_at: SEED_DATE,
    },
  );
  return {
    version: 1,
    currentUserId: 1,
    nextId: 10000,
    users,
    posts,
    comments,
    groups,
    events,
    follows,
    followRequests: [
      { id: 1, from: 6, to: 5 },
      { id: 2, from: 8, to: 5 },
    ],
    memberships,
    invitations: [
      { id: 1, groupId: 7, from: 7, to: 1 },
      { id: 2, groupId: 8, from: 8, to: 5 },
    ],
    joinRequests: [
      { id: 1, groupId: 1, userId: 4 },
      { id: 2, groupId: 2, userId: 5 },
    ],
    likes: Object.fromEntries(
      posts.map((p) => [p.id, [2, 3, 7].filter((id) => id !== p.user_id)]),
    ),
    rsvps: Object.fromEntries(
      events.map((e) => [
        e.id,
        Object.fromEntries(
          memberships
            .filter((m) => m.groupId === e.group_id)
            .slice(0, 3)
            .map((m) => [m.userId, "going"]),
        ),
      ]),
    ),
    messages,
    groupMessages,
    notifications,
  };
}
