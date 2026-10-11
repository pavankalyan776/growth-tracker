/**
 * End-to-end smoke test: renders the REAL app against a RUNNING backend.
 *
 * Start a throwaway backend first (see the root README, "Tests"):
 *   RATE_LIMIT=false ADMIN_EMAIL=boss@example.com ADMIN_PASSWORD=BossPass123 \
 *   DATABASE_URL=sqlite:///./smoke.db uvicorn app.main:app --port 8123
 * then:  VITE_API_URL=http://127.0.0.1:8123 npx vitest run
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "./App";
import { setToken } from "./api";

const stamp = Date.now();
const email = `hunter${stamp}@example.com`;
const ANNOUNCEMENT = `Smoke announcement ${stamp}`;
const wait = { timeout: 8000 };

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  setToken("");
  window.location.hash = "";
});
afterEach(cleanup);

const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

async function signIn(mail, password) {
  render(<App />);
  fireEvent.click(await screen.findByRole("tab", { name: "Sign in" }));
  type("Email", mail);
  type("Password", password);
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

const go = (hash) => { window.location.hash = hash; };

describe("Growth Tracker v5", () => {
  it("shows the sign-in screen to a stranger", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: /Welcome back, hunter/i })).toBeTruthy();
    expect(screen.queryByText("Admin console")).toBeNull();
  });

  it("registers, onboards, and lets a member tick a quest", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("tab", { name: "Create account" }));
    type("Hunter name", "Smoky");
    type("Email", email);
    type("Password", "Smoke1234pass");
    fireEvent.click(screen.getByRole("button", { name: /Create account/ }));

    expect(await screen.findByText(/Make it yours/i, {}, wait)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText(/Pick your starting quests/i)).toBeTruthy();
    fireEvent.click(await screen.findByRole("radio", { name: /Exam \+ AI Engineer/i }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText(/Set your plan window/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(await screen.findByRole("button", { name: /Enter the gate/i }));

    const boxes = await screen.findAllByRole("checkbox", {}, wait);
    expect(boxes.length).toBeGreaterThan(3);
    expect(boxes[0].getAttribute("aria-checked")).toBe("false");
    fireEvent.click(boxes[0]);
    await waitFor(() => expect(screen.getAllByRole("checkbox")[0].getAttribute("aria-checked")).toBe("true"));

    // a member never sees the admin console, and its address sends them home
    expect(screen.queryByText("Admin console")).toBeNull();
    go("#/admin/members");
    await waitFor(() => expect(window.location.hash).toBe("#/today"), wait);
  });

  it("has a grouped menu with Plan, Challenges and Rewards tabs", async () => {
    await signIn(email, "Smoke1234pass");
    await screen.findAllByRole("checkbox", {}, wait);
    const nav = screen.getAllByRole("navigation", { name: "Main" })[0];
    for (const name of ["Today", "Plan", "Challenges", "Progress", "Rewards", "Profile"]) {
      expect(within(nav).getByRole("link", { name: new RegExp(name) })).toBeTruthy();
    }
    go("#/quests");
    expect(await screen.findByRole("link", { name: /Calendar/ }, wait)).toBeTruthy();
    expect(screen.getByRole("link", { name: /My quests/ }).getAttribute("aria-current")).toBe("page");
  });

  it("clears a daily dare, then switches to the Calm words", async () => {
    await signIn(email, "Smoke1234pass");
    const dare = await screen.findByRole("button", { name: /I did it/i }, wait);
    fireEvent.click(dare);
    await waitFor(() => expect(screen.getByRole("button", { name: /Undo/i }).getAttribute("aria-pressed")).toBe("true"), wait);

    fireEvent.click(screen.getAllByRole("button", { name: /Look/ })[0]);
    fireEvent.click(await screen.findByRole("radio", { name: /Calm/ }));
    expect(document.documentElement.getAttribute("data-style")).toBe("calm");
    expect((await screen.findAllByText(/habits/i)).length).toBeGreaterThan(0);
  });

  it("builds a challenge from a form and checks in", async () => {
    await signIn(email, "Smoke1234pass");
    await screen.findAllByRole("checkbox", {}, wait);
    go("#/challenges");
    fireEvent.click((await screen.findAllByRole("button", { name: /Build a challenge/ }, wait))[0]);
    fireEvent.change(await screen.findByLabelText("What will you do?"), { target: { value: "Stretch every morning" } });
    fireEvent.click(screen.getByRole("button", { name: "Create challenge" }));
    const card = await screen.findByRole("region", { name: "Stretch every morning" }, wait);
    fireEvent.click(within(card).getByRole("button", { name: /Check in today/ }));
    await waitFor(() => expect(within(card).getByRole("button", { name: /Checked in/ }).getAttribute("aria-pressed")).toBe("true"), wait);
    await waitFor(() => expect(card.textContent).toMatch(/1 of 7 check-ins/));
  });

  it("shows the Leaderboard as an opt-in, not a public list", async () => {
    await signIn(email, "Smoke1234pass");
    await screen.findAllByRole("checkbox", {}, wait);
    go("#/hall");
    expect(await screen.findByText(/Want to compete with friends/i, {}, wait)).toBeTruthy();
  });

  it("rejects a wrong password with a plain message", async () => {
    await signIn(email, "WrongPass999");
    expect(await screen.findByRole("alert", {}, wait)).toBeTruthy();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("gives the admin a separate console and a content studio that publishes announcements", async () => {
    await signIn("boss@example.com", "BossPass123");
    // admins land in their own app, not the member tracker
    expect(await screen.findByText(/What this console can't show/i, {}, wait)).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getAllByRole("link", { name: /Open my tracker/ }).length).toBeGreaterThan(0);

    go("#/admin/studio/announcements");
    fireEvent.click(await screen.findByRole("button", { name: /New announcement/ }, wait));
    fireEvent.change(await screen.findByLabelText(/Headline/), { target: { value: ANNOUNCEMENT } });
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect((await screen.findAllByText(ANNOUNCEMENT, {}, wait)).length).toBeGreaterThan(0);

    go("#/admin/members");
    expect(await screen.findByRole("heading", { name: /Members/ }, wait)).toBeTruthy();
    expect((await screen.findAllByText(email, {}, wait)).length).toBeGreaterThan(0);
  });

  it("shows the published announcement on the member's Today page", async () => {
    await signIn(email, "Smoke1234pass");
    expect(await screen.findByText(ANNOUNCEMENT, {}, wait)).toBeTruthy();
  });
});
