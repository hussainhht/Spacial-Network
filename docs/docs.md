# About the `docs` Folder

This document explains what the `docs` folder is for and how the team should use it.

---

## 1. Purpose of the `docs` Folder

The `docs` folder is the central place for documenting important information about the Social Network project.

It is **not only** for documenting code. It is the project's knowledge base — the place where we write down anything important we build, decide, or learn while working on this project.

Topics that belong here include:

- Backend architecture
- Frontend architecture
- Database design
- Database migrations
- API flows
- Authentication
- Sessions and cookies
- WebSockets
- Docker
- Git workflows
- Conventional Commits
- Development standards
- Technical decisions
- Problems we faced
- Solutions we used
- Important concepts we learned
- Useful references for the team
- TODOs and implementation plans, when appropriate

If it helps the team understand, maintain, or build on the project, it belongs in `docs`.

---

## 2. Documentation Is Not Only About Code

Building this project also means learning new technologies and concepts. We want to document that learning too, not just the code itself.

Examples of learning topics worth documenting:

- CORS
- Dependency Injection
- Database migrations
- WebSockets
- Sessions and cookies
- Next.js concepts
- Go project architecture
- Git workflows
- Conventional Commits
- Database relationships
- Backend/frontend communication
- Other important technologies or concepts we pick up during development

If a team member learns something that was hard to understand or figure out, writing it down helps the whole team — now and later.

---

## 3. Why We Do This

During development, important knowledge is easy to forget. A few weeks after making a decision, it's common to no longer remember:

- Why we chose a specific architecture
- Why a database table was designed in a certain way
- How a system actually works
- Why we used a specific solution
- What problem we faced
- How we solved that problem
- What new concept we learned

Instead of keeping this knowledge only in our heads or buried in AI/chat conversations, we save it inside the project, where the whole team can find it and benefit from it — including us, in the future.

---

## 4. When to Add Documentation

Team members should consider adding documentation when they:

- Build an important system
- Learn an important concept
- Make an important architectural decision
- Create a team development standard
- Solve a difficult problem
- Change an important project structure
- Discover something that could help the team later

**We do not need documentation for every small code change.** Small fixes, minor tweaks, and routine work don't need a doc entry.

Documentation should focus on information that will actually be useful later — for understanding, maintaining, explaining, or learning from the project. If it's not useful later, skip it.

---

## 5. Documentation as a Learning Reference

This project is also a learning project. Because of that, the `docs` folder should grow into a knowledge base for the team, not just a technical manual.

The goal is to document:

- What we built
- How we built it
- Why we built it that way
- What we learned while building it

This makes `docs` useful both as project documentation and as a personal/team learning record.

---

## 6. The `docs` Folder and the Final README

When the project is finished, the `docs` folder will be one of the main references used to write the final root `README.md`.

Instead of trying to remember everything at the end of the project, we will already have the important information documented along the way.

The final README can pull from `docs` to describe things such as:

- Project overview
- Main features
- Technologies used
- Project architecture
- Backend structure
- Frontend structure
- Database design
- Authentication
- WebSockets
- Docker setup
- How to run the project
- Important technical decisions
- Development practices
- What we learned during the project

**The difference between the two:**

- `docs/` = detailed project and learning documentation, written as we go
- `README.md` = an organized, high-level overview of the completed project, written for someone new

---

## 7. The Main Goal

By the end of the project, the documentation in `docs` should help us answer:

- What did we build?
- How did we build it?
- Why did we build it this way?
- What problems did we face?
- How did we solve them?
- What technologies and concepts did we learn?
- How did the project evolve during development?

If the docs folder can answer these questions, it has done its job.
