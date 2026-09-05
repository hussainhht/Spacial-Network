# Git Commit Message Convention

This document explains how we write Git commit messages in the Social Network project. Every team member should follow this guide so our commit history stays clean, consistent, and easy to understand.

We use the **Conventional Commits** standard.

---

## 1. What Are Conventional Commits?

Conventional Commits is a simple, widely used convention for writing commit messages. Instead of writing free-form text like `update stuff`, every commit follows a predictable pattern that describes:

- **what kind of change** was made (a new feature, a bug fix, documentation, etc.)
- **which part of the project** was affected
- **a short description** of what actually changed

This makes commit history readable like a changelog, instead of a random list of notes.

---

## 2. Why We Use Them in This Project

- **Clarity** — Anyone on the team can look at `git log` and understand what happened, without opening the code.
- **Consistency** — Everyone writes commits the same way, so the history doesn't look messy or mixed.
- **Easier reviews** — Reviewers know what to expect from a commit before even reading the diff.
- **Better collaboration** — With multiple people working on auth, groups, posts, chat, etc., clear commits make it obvious who changed what and why.
- **Searchable history** — You can search the log for `fix(auth)` or `feat(groups)` and instantly find relevant commits.

---

## 3. Commit Message Structure

Every commit message must follow this format:

```
type(scope): short description
```

Example:

```
feat(groups): add group creation endpoint
```

- `type` — the category of change (see section 5).
- `scope` — the part of the project affected (see section 7).
- `description` — a short, clear explanation of what the commit does.

---

## 4. What `type`, `scope`, and `description` Mean

- **type**
  A keyword that tells everyone what kind of change this is. For example, `feat` for a new feature or `fix` for a bug fix.

- **scope**
  The area or module of the project the commit touches, written in parentheses. For example, `(auth)`, `(groups)`, `(posts)`.

- **description**
  A short sentence (a few words) explaining what the commit actually does. It should be specific enough that someone reading only the commit message understands the change.

---

## 5. Commit Types and When to Use Them

| Type | When to use it |
|------|-----------------|
| `feat` | You added a new feature or new functionality that didn't exist before. |
| `fix` | You fixed a bug or corrected behavior that was broken or incorrect. |
| `docs` | You only changed documentation (README, markdown files, comments-as-docs). No code logic changed. |
| `refactor` | You changed how the code is structured or organized, without changing what it does. |
| `style` | You changed formatting, spacing, naming, or code style — no logic changes at all. |
| `test` | You added, updated, or fixed tests. |
| `chore` | Routine maintenance work that doesn't fit other types (e.g. updating `.gitignore`, cleaning unused files). |
| `perf` | You made the code faster or more efficient without changing its behavior. |
| `build` | You changed something related to the build process, Docker setup, or dependencies. |
| `ci` | You changed CI/CD configuration (pipelines, GitHub Actions, automated workflows). |

---

## 6. Examples for Every Commit Type

```
feat(chat): add private messaging

fix(followers): prevent duplicate follow requests

docs(cors): explain frontend backend CORS flow

refactor(database): simplify migration setup

style(posts): format post handler file

test(auth): add tests for login endpoint

chore(backend): remove unused imports

perf(posts): reduce query time for post feed

build(docker): update backend Dockerfile base image

ci(backend): add automated test workflow
```

---

## 7. Recommended Scopes for This Project

Use one of these scopes whenever possible, so scopes stay consistent across the team:

- `auth`
- `database`
- `groups`
- `posts`
- `comments`
- `profile`
- `followers`
- `chat`
- `notifications`
- `reels`
- `frontend`
- `backend`
- `cors`
- `docker`

If a change doesn't fit any of these, it's fine to introduce a new scope — just keep it short, lowercase, and descriptive.

---

## 8. Real Project Examples

```
feat(groups): add group invitation system
feat(posts): add post privacy levels
feat(profile): add profile privacy settings
feat(chat): add private messaging
feat(auth): add logout endpoint

fix(auth): fix session cookie expiration
fix(groups): prevent duplicate join requests
fix(followers): prevent duplicate follow requests

refactor(auth): restructure authentication setup
refactor(database): simplify migration setup

docs(database): add migration documentation
docs(cors): explain frontend backend CORS flow
```

---

## 9. `feat` vs `fix` vs `refactor` (Don't Confuse These!)

These three types are the easiest to mix up. Here's the simple rule:

- **`feat`** — You added something **new** that didn't exist before.
  Example: `feat(chat): add private messaging`

- **`fix`** — You corrected something that was **broken or behaving incorrectly**.
  Example: `fix(auth): fix session cookie expiration`

- **`refactor`** — You changed **how the code is written or organized**, but the behavior stays exactly the same. No new feature, no bug fix.
  Example: `refactor(database): simplify migration setup`

Quick way to decide:

| Question | Answer | Type |
|----------|--------|------|
| Did I add something new that users/other code can now do? | Yes | `feat` |
| Was something broken, and now it works correctly? | Yes | `fix` |
| Does the code behave exactly the same, just organized differently? | Yes | `refactor` |

---

## 10. Bad Commit Messages

Avoid vague commit messages that don't explain anything. These should **never** be used:

```
update
changes
fix
done
work
new stuff
some changes
```

These messages don't tell the team what changed, why, or where. Always replace them with a proper Conventional Commit message.

### Examples: Bad vs Good

**Bad:**
```
update
```
**Good:**
```
feat(groups): add group member list
```

**Bad:**
```
fix
```
**Good:**
```
fix(auth): prevent invalid session access
```

**Bad:**
```
changes
```
**Good:**
```
refactor(posts): separate post handler and service logic
```

**Bad:**
```
work
```
**Good:**
```
feat(notifications): add unread notification badge
```

---

## 11. Git Command Examples

```
git add .

git commit -m "feat(groups): add group creation"

git commit -m "fix(auth): fix login cookie handling"

git commit -m "refactor(groups): separate handler and service logic"
```

---

## 12. Team Rules

- Use lowercase for the commit type (`feat`, not `Feat` or `FEAT`).
- Prefer lowercase for the scope (`auth`, not `Auth`).
- Keep the description short and specific.
- Describe what the commit actually changes.
- Do not use vague messages such as `update`, `changes`, or `work`.
- Do not use `feat` for every commit — use the type that matches the real change.
- Use the correct type based on the actual change (`fix` for bugs, `refactor` for restructuring, etc.).
- Keep one commit focused on one logical change when possible.
- Do not add a period at the end of the commit description.
- Use imperative-style descriptions when possible, such as "add", "fix", "remove", "update", or "refactor" (write `add login endpoint`, not `added login endpoint` or `adds login endpoint`).

---

## 13. Quick Reference Table

| Type | Purpose |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code restructuring without behavior change |
| `style` | Formatting/style only |
| `test` | Tests |
| `chore` | Maintenance |
| `perf` | Performance improvement |
| `build` | Build/Docker/dependency changes |
| `ci` | CI/CD changes |

---

## 14. Before You Commit — Quick Checklist

Before writing your commit message, ask yourself:

- What type of change did I make?
- What part of the project did I change?
- Can another developer understand this commit without opening the code?

Then write your commit using the format:

```
type(scope): short description
```
