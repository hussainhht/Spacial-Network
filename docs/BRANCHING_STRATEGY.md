# Git Branching Strategy

This document explains the Git branching workflow used in the Social Network project. Every team member should follow this guide so we can work in parallel without stepping on each other's work, and so our repository stays clean and easy to navigate.

**Important project rule:** We do **not** use a `develop` branch. The `main` branch is our single central integration branch — all completed team work is merged directly into it through Pull Requests.

---

## 1. Purpose

We use branches instead of everyone committing to the same branch because it solves several real problems that come up as soon as more than one person works on the same codebase:

- **Keep `main` clean** — `main` should always represent working, reviewed code. Unfinished or experimental work should never sit on it.
- **Avoid team members overwriting each other's work** — When everyone works on their own branch, one person's in-progress changes can't accidentally break or overwrite someone else's.
- **Make code review easier** — A branch with one focused change is easy to review. A shared branch with everyone's work mixed together is not.
- **Keep features and fixes isolated** — If a feature turns out to be broken or needs to be paused, it stays contained on its own branch instead of affecting everything else.
- **Make Git history easier to understand** — Clear branches and Pull Requests let anyone look at the project's history and understand what was built, when, and why.

---

## 2. Main Branch

- `main` is the primary and only long-lived branch in this project.
- All completed features and fixes are merged into `main` once they are reviewed and working.
- Team members should **not** develop directly on `main`.
- Direct pushes to `main` should be avoided — work should always enter `main` through a Pull Request.
- Before starting new work, developers should update their local `main` so their new branch starts from the latest code.

Because we don't use a `develop` branch, `main` also acts as the integration point where all feature and fix branches eventually come together. This keeps the workflow simple and avoids an extra branch that would need to be kept in sync.

```text
main
│
├── feat/groups-events
├── feat/posts-privacy
├── feat/followers-requests
├── feat/chat-private
├── fix/auth-session
└── docs/git-workflow
```

Each of these branches is created from `main`, developed independently, and merged back into `main` through a Pull Request.

---

## 3. Branch Naming Convention

Every branch name must follow this format:

```text
type/scope-description
```

- **`type`** — the type of work being done (see [Section 4](#4-allowed-branch-types)).
- **`scope`** — the feature or module being changed (for example `groups`, `posts`, `auth`, `chat`).
- **`description`** — a short, specific description of the actual task the branch covers.

This mirrors our [Conventional Commits](./CONVENTIONAL_COMMITS.md) format (`type(scope): description`), so branch names and commit messages stay consistent and predictable across the project.

### Examples

```text
feat/groups-create
feat/groups-events
feat/posts-create
feat/posts-privacy
feat/comments-create
feat/profile-privacy
feat/followers-requests
feat/websocket-core
feat/chat-private
feat/chat-group

fix/auth-cookie
fix/groups-duplicate-request
fix/chat-disconnect

refactor/database-migrations

docs/git-workflow
docs/database-schema

test/groups-events

build/docker-backend
```

---

## 4. Allowed Branch Types

| Type        | Purpose                                      |
| ----------- | --------------------------------------------- |
| `feat/`     | New feature or functionality                  |
| `fix/`      | Bug fix                                       |
| `refactor/` | Code restructuring without changing behavior  |
| `docs/`     | Documentation changes                         |
| `test/`     | Tests                                         |
| `chore/`    | Maintenance work                              |
| `build/`    | Docker, dependencies, or build configuration  |
| `ci/`       | CI/CD configuration                           |

These branch types should stay consistent with the types used in our [Conventional Commits documentation](./CONVENTIONAL_COMMITS.md). Using the same set of types for both branches and commits means a branch name always tells you what kind of commits to expect inside it.

---

## 5. Feature Branch Size

A branch should represent **one clear task** — not an entire feature area, not an entire person's workload.

### Avoid overly broad branches

```text
feat/groups
feat/backend
feat/person1-work
```

These names don't say what is actually being done, and they tend to grow into large branches that mix many unrelated changes together.

### Prefer smaller, focused branches

```text
feat/groups-create
feat/groups-members
feat/groups-join-requests
feat/groups-invitations
feat/groups-events
```

Smaller branches make:

- **Pull Requests easier to review** — a reviewer can understand a small, focused diff much faster than a huge one.
- **Merge conflicts easier to resolve** — fewer files touched means fewer chances of conflicting with someone else's work.
- **Bugs easier to identify** — if something breaks, it's much easier to trace it back to a small, specific change.
- **Git history easier to understand** — anyone browsing the log can see exactly what each branch and merge was for.

---

## 6. Starting a New Branch

Always create a new branch from the latest version of `main`. This ensures your work starts on top of everything the team has already merged, avoiding unnecessary conflicts later.

```bash
git switch main
git pull

git switch -c feat/groups-events
```

- `git switch main` — moves you onto the `main` branch.
- `git pull` — updates your local `main` with the latest changes from the remote.
- `git switch -c feat/groups-events` — creates and switches to a new branch based on that up-to-date `main`.

---

## 7. Working and Committing

Once your branch is created, work normally and commit your changes following the project's [Conventional Commits](./CONVENTIONAL_COMMITS.md) rules:

```bash
git add .
git commit -m "feat(groups): add event creation"
```

Commit messages must follow this format:

```text
type(scope): description
```

Keeping commits scoped to the branch's task makes each commit easy to understand on its own, and keeps the branch's history focused instead of scattered.

### Example relationship between a branch and its commits

```text
Branch:
feat/groups-events

Commits:
feat(groups): add event repository
feat(groups): add event service
feat(groups): add event endpoint
test(groups): add event service tests
```

Notice how every commit stays inside the scope of the branch (`groups`) and builds toward the same task (`events`). This is what makes a branch easy to review as a whole.

---

## 8. Pushing a Branch

Once you have commits ready to share, push the branch to the remote repository:

```bash
git push -u origin feat/groups-events
```

The `-u origin` flag sets `origin/feat/groups-events` as the upstream branch for your local branch. This means that after the first push, you can simply run `git push` or `git pull` on this branch without specifying the remote and branch name every time.

---

## 9. Pull Request Workflow

All work reaches `main` through a Pull Request, never through a direct push.

```text
Developer Branch
       │
       ▼
Pull Request
       │
       ▼
Code Review
       │
       ▼
main
```

### Rules

- The Pull Request target must always be `main`.
- Review the changes before merging — don't merge your own Pull Request without at least one other team member looking at it when possible.
- Check for accidental files or unrelated changes before merging.
- Resolve any conflicts before merging.
- Make sure the feature actually works before merging, not just that it "looks right."
- Delete the branch after a successful merge, once it is no longer needed.

This process is what actually protects `main` — the rules in [Section 2](#2-main-branch) only work if every change passes through this Pull Request flow.

---

## 10. Updating a Feature Branch

While you're working on a branch, `main` may move forward as other team members merge their own Pull Requests. To avoid your branch drifting too far out of date — and to catch conflicts early instead of at the end — bring those changes into your branch regularly.

```bash
git switch main
git pull

git switch feat/groups-events
git merge main
```

This brings the newest team changes into your feature branch, so you're always building on top of the latest code. If conflicts show up, resolve them at this point, while the change is still small and fresh in your mind, rather than facing a large conflict later at Pull Request time.

We keep this workflow simple on purpose — a plain `merge` is enough for this project, and there is no need to introduce more advanced Git workflows (such as rebasing) unless the team decides otherwise.

---

## 11. Bug Fix Branches

Once a feature branch has been merged into `main`, it should generally not be reopened or reused for later fixes. Instead, create a new `fix/` branch.

**Example:**

The branch:

```text
feat/groups-invitations
```

gets merged into `main`.

Later, a bug is discovered in that feature.

Create a new branch for it instead of going back to the old one:

```text
fix/groups-duplicate-invitations
```

This keeps the history clear: anyone reading the branch and Pull Request list can see exactly which change introduced the feature, and which separate change fixed a bug in it.

---

## 12. Branches to Avoid

Avoid branch names that don't describe the actual change being made, such as:

```text
my-branch
test
new
changes
work
person1
sayed
backend-work
final
final2
```

Branch names should describe **what the branch does**, not **who is working on it** or how far along the project is. Names like `person1` or `sayed` say nothing about the task once the branch shows up in a list next to a dozen others, and names like `final` or `final2` become confusing (and often inaccurate) as soon as more changes are needed. Always use the `type/scope-description` format from [Section 3](#3-branch-naming-convention) instead.

---

## 13. Team Feature Examples

These examples are based on the current features being built across the project.

### Groups

```text
feat/groups-create
feat/groups-members
feat/groups-join-requests
feat/groups-invitations
feat/groups-events
feat/groups-event-responses
```

### Posts & Comments

```text
feat/posts-create
feat/posts-feed
feat/posts-privacy
feat/comments-create
feat/group-posts
feat/group-comments
```

### Profile & Followers

```text
feat/profile-page
feat/profile-privacy
feat/followers-follow
feat/followers-unfollow
feat/followers-requests
feat/followers-lists
```

### WebSocket, Chat & Notifications

```text
feat/websocket-core
feat/chat-private
feat/chat-history
feat/chat-group
feat/notifications-core
feat/notifications-realtime
```

---

## 14. Complete Workflow Example

A full example, from starting a branch to merging it back into `main`.

```bash
git switch main
git pull

git switch -c feat/groups-events

# work on the feature

git add .
git commit -m "feat(groups): add event repository"

git add .
git commit -m "feat(groups): add event service"

git push -u origin feat/groups-events
```

Then, on GitHub (or your Git hosting platform):

```text
Create Pull Request:

feat/groups-events → main
```

After the Pull Request is reviewed and merged:

```bash
git switch main
git pull
```

Optionally, delete the local branch since it's no longer needed:

```bash
git branch -d feat/groups-events
```

---

## 15. Quick Reference

```text
Main branch:
main

Branch format:
type/scope-description

Commit format:
type(scope): description

Pull Request:
feature branch → main

Never:
work directly on main
```
