"""Exercise real routes and social flows against the disposable local backend.

Run via npm run test:smoke. Requires Python Playwright and Chromium.
No HTTP or WebSocket mocks are used.
"""
import base64
import json
import os
import re
import time
from datetime import datetime, timedelta
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

BASE = "http://localhost:3000"
API = "http://localhost:8080/api"
ARTIFACTS = Path(os.environ["CLEANUP_ARTIFACTS"])
ARTIFACTS.mkdir(parents=True, exist_ok=True)
PASSWORD = "CleanupTest123!"
SUFFIX = str(time.time_ns())[-10:]
ALICE = f"cleanup_a_{SUFFIX}"
BOB = f"cleanup_b_{SUFFIX}"
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7XcAAAAASUVORK5CYII=")
checks = []
errors = []
failed_responses = []
model_requests = []


def passed(name):
    checks.append(name)
    print(f"PASS {name}", flush=True)


def settle(page):
    page.wait_for_load_state("networkidle")


def visit(page, route):
    response = page.goto(BASE + route)
    assert response and response.ok, (route, response.status if response else None)
    settle(page)


def sky(page):
    expect(page.locator("[data-space-background]")).to_have_count(1)
    expect(page.locator("canvas")).to_have_count(0)
    assert page.locator("[data-space-background] svg path").count() > 0


def api(response):
    assert response.ok, (response.status, response.text())
    return response.json() if response.body() else None


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1440, "height": 1000})
    page = context.new_page()
    page.set_default_timeout(10000)
    page.on("pageerror", lambda error: errors.append(str(error)))
    try:
        visit(page, "/register")
        sky(page)
        for field, value in {"username": ALICE, "firstName": "Cleanup", "lastName": "Alice", "email": f"{ALICE}@example.test", "password": PASSWORD, "age": "30"}.items():
            page.locator(f"#{field}").fill(value)
        page.get_by_role("button", name="Register", exact=True).click()
        page.wait_for_url(BASE + "/login")
        settle(page)
        sky(page)
        page.screenshot(path=str(ARTIFACTS / "login.png"), full_page=True)
        page.locator("#username").fill(ALICE)
        page.locator("#password").fill(PASSWORD)
        page.get_by_role("button", name="Login", exact=True).click()
        page.wait_for_url(BASE + "/")
        settle(page)
        passed("Registration, login, and cookie session")
        # Logged-out WebSocket rejection is expected; monitor errors after login.
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
        page.on("request", lambda request: model_requests.append(request.url) if ".glb" in request.url else None)
        page.on("response", lambda response: failed_responses.append(f"{response.status} {response.url}") if response.status >= 400 else None)
        alice_id = api(context.request.get(API + "/login"))["user_id"]
        for label, route in [("Create", "/posts/new"), ("Groups", "/groups"), ("Profile", "/profile"), ("Messages", "/chat"), ("Home", "/")]:
            page.get_by_role("navigation", name="Primary navigation", exact=True).get_by_role("link", name=label, exact=True).click()
            page.wait_for_url(BASE + route)
            settle(page)
            expect(page.locator("#app-page-title")).to_have_text("New Post" if label == "Create" else label)
            sky(page)
            expect(page.locator("#page-content[inert]")).to_have_count(0)
            expect(page.locator("#page-content")).to_contain_text(re.compile(r"\S"))
        passed("Five primary destinations: Home, Groups, Create, Messages, Profile")
        page.go_back(); page.wait_for_url(BASE + "/chat"); settle(page)
        page.go_forward(); page.wait_for_url(BASE + "/"); settle(page)
        passed("Browser back and forward")
        page.get_by_role("button", name="Hide navigation", exact=True).click()
        page.reload(); settle(page)
        expect(page.get_by_role("button", name="Show navigation", exact=True)).to_be_visible()
        page.get_by_role("button", name="Show navigation", exact=True).click()
        passed("Navigation visibility preference survives reload")

        # Exercise the presentation at full desktop, tablet, and phone sizes.
        destinations = [("Home", "/"), ("Groups", "/groups"), ("Create", "/posts/new"), ("Messages", "/chat"), ("Profile", "/profile")]
        for width, height in [(1440, 1000), (1024, 768), (768, 1024), (390, 844), (320, 568), (844, 390)]:
            page.set_viewport_size({"width": width, "height": height})
            for label, route in destinations:
                nav = page.get_by_role("navigation", name="Primary navigation", exact=True)
                expect(nav).to_be_visible()
                expect(nav.get_by_role("link")).to_have_count(5)
                nav.get_by_role("link", name=label, exact=True).click()
                page.wait_for_url(BASE + route); settle(page)
                expect(nav.locator('[aria-current="page"]')).to_have_count(1)
                expect(nav.locator('[aria-current="page"]')).to_have_attribute("aria-label", label)
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), (width, route)
                assert page.evaluate("document.documentElement.scrollHeight <= innerHeight"), (width, route)
                assert nav.locator("a").evaluate_all("els => els.every(el => { const r = el.getBoundingClientRect(); return r.width >= 44 && r.height >= 44 && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; })"), (width, route)
                expect(nav.get_by_text("Logout", exact=True)).to_have_count(0)
                if width > 760 and height > 430:
                    assert nav.bounding_box()["x"] + nav.bounding_box()["width"] <= page.locator("#page-content").bounding_box()["x"]
                    assert nav.evaluate("el => el.scrollHeight <= el.clientHeight")
                else:
                    reserved = page.locator("#page-content").evaluate("el => parseFloat(getComputedStyle(el).paddingBottom)")
                    assert reserved >= height - nav.bounding_box()["y"]
            page.screenshot(path=str(ARTIFACTS / f"orbital-{width}x{height}.png"), full_page=True)
            # Tab order follows the five visible destinations on both layouts.
            nav.get_by_role("link", name="Home", exact=True).focus()
            for label, _ in destinations[1:]:
                page.keyboard.press("Tab")
                expect(nav.get_by_role("link", name=label, exact=True)).to_be_focused()
                assert nav.get_by_role("link", name=label, exact=True).evaluate("el => getComputedStyle(el).outlineStyle !== 'none'")
        passed("Orbital/dock links, active states, touch targets, keyboard focus, content clearance and overflow at six viewport sizes")
        page.emulate_media(reduced_motion="reduce")
        assert nav.locator("a, a span").evaluate_all("els => els.every(el => getComputedStyle(el).transitionDuration === '0s')")
        page.emulate_media(reduced_motion="no-preference")
        page.set_viewport_size({"width": 1440, "height": 1000})
        visit(page, "/")

        # Post creation, upload, comments, and editing use the real UI.
        page.get_by_role("link", name="Create new post", exact=True).click()
        settle(page)
        page.get_by_label("Title", exact=True).fill("Cleanup smoke post")
        page.get_by_label("Content", exact=True).fill("A real feed post without any planet dependency.")
        page.locator('input[type="file"]').set_input_files({"name": "smoke.png", "mimeType": "image/png", "buffer": PNG})
        page.locator('.post-form button[type="submit"]').click()
        page.wait_for_url(BASE + "/posts")
        settle(page)
        page.get_by_role("link", name="Cleanup smoke post", exact=True).click()
        page.wait_for_url(re.compile(r"/posts/\d+$"))
        settle(page)
        post_id = int(page.url.rsplit("/", 1)[1])
        expect(page.locator('.post-card-image')).to_be_visible()
        page.locator(".comments-section textarea").fill("Comment from the cleanup smoke test.")
        page.locator('.comments-section button[type="submit"]').click()
        expect(page.get_by_text("Comment from the cleanup smoke test.", exact=True)).to_be_visible()
        visit(page, f"/posts/{post_id}/edit")
        page.get_by_label("Title", exact=True).fill("Edited cleanup post")
        page.locator('.post-form button[type="submit"]').click()
        page.wait_for_url(BASE + f"/posts/{post_id}")
        settle(page)
        expect(page.get_by_role("heading", name="Edited cleanup post", exact=True)).to_be_visible()
        passed("Post create, image upload, detail, comment, and edit")

        # A second test account supplies follow, invite, notification and chat events.
        bob = browser.new_context(viewport={"width": 1440, "height": 1000})
        api(bob.request.post(API + "/register", multipart={"username": BOB, "firstName": "Cleanup", "lastName": "Bob", "email": f"{BOB}@example.test", "password": PASSWORD, "gender": "male", "age": "30"}))
        api(bob.request.post(API + "/login", data={"username": BOB, "password": PASSWORD}))
        bob_id = api(bob.request.get(API + "/login"))["user_id"]
        visit(page, f"/profile/{BOB}")
        expect(page.locator("#orbital-navigation [aria-current=page]")).to_have_attribute("aria-label", "Profile")
        page.get_by_role("button", name="Follow", exact=True).click()
        expect(page.get_by_role("button", name="Unfollow", exact=True)).to_be_visible()
        visit(page, "/profile")
        expect(page.get_by_role("banner").get_by_text("@" + ALICE, exact=True)).to_be_visible()
        passed("Profile and follow action")

        visit(page, "/groups/create")
        expect(page.locator("#orbital-navigation [aria-current=page]")).to_have_attribute("aria-label", "Groups")
        page.get_by_label("Group name", exact=True).fill("Cleanup smoke group")
        page.get_by_label("Description", exact=True).fill("A community for isolated frontend validation.")
        with page.expect_response(lambda response: response.url == API + "/groups" and response.request.method == "POST") as response:
            page.get_by_role("button", name="Create Group →", exact=True).click()
        group_id = api(response.value)["group_id"]
        page.get_by_role("button", name="Skip for now", exact=True).click()
        page.wait_for_url(BASE + f"/groups/{group_id}")
        settle(page)
        expect(page.get_by_role("heading", name="Cleanup smoke group", exact=True)).to_be_visible()
        # Existing group chat is a disabled Coming Soon tab, not a working feature.
        expect(page.get_by_role("tab", name=re.compile("Chat"))).to_be_disabled()
        page.get_by_role("tab", name="Events", exact=True).click()
        page.get_by_role("button", name=re.compile("Create Event")).click()
        dialog = page.get_by_role("dialog", name="Create Event", exact=True)
        dialog.get_by_label("Title", exact=True).fill("Cleanup test event")
        dialog.get_by_label("Description", exact=True).fill("Verify event creation and RSVP.")
        dialog.get_by_label("Date", exact=True).fill((datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d"))
        dialog.get_by_label("Time", exact=True).fill("18:00")
        dialog.get_by_role("button", name="Create Event", exact=True).click()
        expect(page.get_by_role("heading", name="Cleanup test event", exact=True)).to_be_visible()
        page.get_by_role("button", name="Going", exact=True).click()
        expect(page.get_by_role("button", name="✓ Going", exact=True)).to_be_visible()
        passed("Group creation, details, events, and RSVP; existing disabled group-chat tab retained")

        api(context.request.post(API + f"/groups/{group_id}/posts", multipart={"title": "Cleanup group post", "content": "Group-only post content"}))
        page.get_by_role("tab", name="Posts", exact=True).click()
        expect(page.get_by_role("link", name="Cleanup group post", exact=True)).to_be_visible()
        passed("Group posts render through the shared post card")
        page.get_by_role("tab", name="Overview", exact=True).click()
        page.get_by_role("button", name="+ Invite", exact=True).click()
        dialog = page.get_by_role("dialog", name="Invite people", exact=True)
        search = dialog.get_by_role("textbox")
        search.fill(BOB)
        expect(dialog.get_by_text("@" + BOB, exact=True)).to_be_visible()
        search.fill("")
        expect(dialog.get_by_text("@" + BOB, exact=True)).to_have_count(0)
        search.fill(BOB)
        dialog.get_by_role("button", name="+ Invite", exact=True).click()
        expect(dialog.get_by_role("button", name="✓ Invited", exact=True)).to_be_visible()
        page.get_by_role("button", name="Close invite dialog", exact=True).click()
        passed("Debounced WebSocket invite search, clear, repeat, and invitation")
        invitations = api(bob.request.get(API + "/group-invitations"))["invitations"]
        api(bob.request.post(API + f'/group-invitations/{invitations[0]["id"]}/accept'))

        for index in range(12):
            api(context.request.post(API + "/groups", multipart={"title": f"Directory fixture {index:02}", "description": "Pagination fixture"}))
        visit(page, "/groups")
        expect(page.locator(".groups-list > li")).to_have_count(12)
        page.get_by_role("button", name="Next groups →", exact=True).click()
        expect(page.locator(".groups-list > li")).to_have_count(1)
        page.get_by_role("button", name="← Previous", exact=True).click()
        expect(page.locator(".groups-list > li")).to_have_count(12)
        page.get_by_role("searchbox", name="Search groups", exact=True).fill("Cleanup smoke")
        expect(page.locator(".groups-list > li")).to_have_count(1)
        page.get_by_role("button", name="Open preview for Cleanup smoke group", exact=True).click()
        expect(page.get_by_role("button", name="Close group preview", exact=True)).to_be_focused()
        page.keyboard.press("Escape")
        expect(page.locator("#group-preview")).to_have_count(0)
        expect(page.get_by_role("button", name="Open preview for Cleanup smoke group", exact=True)).to_be_focused()
        page.get_by_role("tab", name="All Groups", exact=True).click()
        expect(page.locator(".groups-list > li")).to_have_count(1)
        page.screenshot(path=str(ARTIFACTS / "groups.png"), full_page=True)
        passed("Group search, tabs, offset pagination, preview, Escape, and focus return")

        # Real WebSocket messages in both directions and a persisted conversation.
        bob_page = bob.new_page()
        visit(bob_page, f"/chat?partnerId={alice_id}")
        visit(page, f"/chat?partnerId={bob_id}")
        message = page.get_by_placeholder(f"Message {BOB}...")
        expect(message).to_be_enabled()
        message.fill("Smoke message from Alice")
        message.press("Enter")
        expect(bob_page.locator(".chat-message-content").filter(has_text="Smoke message from Alice")).to_be_visible()
        reply = bob_page.get_by_placeholder(f"Message {ALICE}...")
        reply.fill("Smoke reply from Bob")
        reply.press("Enter")
        expect(page.locator(".chat-message-content").filter(has_text="Smoke reply from Bob")).to_be_visible()
        page.reload(); settle(page)
        expect(page.locator(".chat-message-content").filter(has_text="Smoke reply from Bob")).to_be_visible()
        expect(page.locator(".chat-message-content").filter(has_text="Smoke message from Alice")).to_be_visible()
        page.screenshot(path=str(ARTIFACTS / "messages.png"), full_page=True)
        passed("Private messages in both directions, realtime receipt, and history reload")
        page.get_by_title("Start a new chat", exact=True).click()
        modal = page.get_by_role("dialog", name="New Message", exact=True)
        expect(modal).to_be_visible()
        modal.get_by_role("button", name="Close modal", exact=True).click()
        page.get_by_title("Start a new chat", exact=True).click()
        expect(page.get_by_role("dialog", name="New Message", exact=True)).to_be_visible()
        page.keyboard.press("Escape")
        passed("New message modal opens, closes, and resets")
        page.get_by_role("button", name=re.compile(r"^Notifications")).click()
        expect(page.locator(".notification-dropdown")).to_be_visible()
        page.get_by_role("link", name=re.compile("View all notifications", re.I)).click()
        page.wait_for_url(BASE + "/notifications"); settle(page)
        expect(page.locator(".notifications-container")).to_be_visible()
        passed("Notification dropdown and inbox")

        for route in ["/", "/posts", "/groups", "/profile", "/chat", "/notifications"]:
            page.set_viewport_size({"width": 390, "height": 844})
            visit(page, route)
            sky(page)
            assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), route
            expect(page.get_by_role("navigation", name="Primary navigation", exact=True)).to_be_visible()
            expect(page.locator("#orbital-navigation")).to_be_hidden()
        page.screenshot(path=str(ARTIFACTS / "mobile.png"), full_page=True)
        page.emulate_media(reduced_motion="reduce")
        assert page.locator("[data-space-background] *").evaluate_all("els => els.every(el => getComputedStyle(el).animationName === 'none')")
        passed("Mobile routes, no horizontal overflow, and reduced-motion sky")
        page.set_viewport_size({"width": 1440, "height": 1000})
        visit(page, "/posts")
        page.screenshot(path=str(ARTIFACTS / "posts.png"), full_page=True)
        # The main feed also includes group posts (ListPosts joins group
        # membership), so "Cleanup group post" - created after this post was
        # edited - can sort above it. Scope to this post's own card rather
        # than assuming it is first.
        target_card = page.locator("article", has=page.get_by_role("link", name="Edited cleanup post", exact=True))
        target_card.locator('summary[aria-label="Post actions"]').click()
        page.once("dialog", lambda dialog: dialog.accept())
        target_card.get_by_role("button", name="Delete post", exact=True).click()
        expect(page.get_by_role("link", name="Edited cleanup post", exact=True)).to_have_count(0)
        passed("Post deletion updates the normal feed")
        assert not failed_responses, failed_responses
        assert not model_requests, model_requests
        page.get_by_role("button", name="User account options", exact=True).click()
        page.get_by_role("menuitem", name="Logout", exact=True).click()
        page.wait_for_url(BASE + "/login")
        passed("Top-navbar account menu logout")
        assert not errors, errors
        # Logout can race in-flight notification requests; anything else must succeed.
        assert not [failure for failure in failed_responses if not failure.startswith("401 ")], failed_responses
        passed("No browser runtime, provider, CSS, model, or navigation errors")
    except Exception:
        page.screenshot(path=str(ARTIFACTS / "failure.png"), full_page=True)
        (ARTIFACTS / "failure-dom.txt").write_text(page.locator("body").inner_text())
        raise
    finally:
        (ARTIFACTS / "results.json").write_text(json.dumps({"checks": checks, "errors": errors, "failed_responses": failed_responses}, indent=2))
        browser.close()
