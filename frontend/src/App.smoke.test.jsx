/**
 * End-to-end smoke test: renders the REAL app against a RUNNING backend.
 *
 * Start a throwaway backend first (see the root README, "Tests"):
 *   RATE_LIMIT=false ADMIN_EMAIL=boss@example.com ADMIN_PASSWORD=BossPass123 \
 *   DATABASE_URL=sqlite:///./smoke.db uvicorn app.main:app --port 8000
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "./App";
import { setToken } from "./api";

const stamp = Date.now();
const email = `hunter${stamp}@example.com`;

beforeEach(() => {
  localStorage.clear();
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

describe("Growth Tracker v4", () => {
  it("shows the sign-in screen to a stranger", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: /Welcome back, hunter/i })).toBeTruthy();
    expect(screen.queryByText("Console")).toBeNull();
  });

  it("registers, onboards, and lets a hunter tick a quest", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("tab", { name: "Create account" }));
    type("Hunter name", "Smoky");
    type("Email", email);
    type("Password", "Smoke1234pass");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    // onboarding: look -> template -> window -> enter
    expect(await screen.findByText(/Make it yours/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText(/Pick your starting quests/i)).toBeTruthy();
    fireEvent.click(await screen.findByRole("radio", { name: /Exam \+ AI Engineer/i }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText(/Set your plan window/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(await screen.findByRole("button", { name: /Enter the gate/i }));

    // Today: real checkboxes appear and one can be ticked
    const boxes = await screen.findAllByRole("checkbox");
    expect(boxes.length).toBeGreaterThan(3);
    const first = boxes[0];
    expect(first.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(first);
    await waitFor(() => expect(screen.getAllByRole("checkbox")[0].getAttribute("aria-checked")).toBe("true"));

    // a normal hunter never sees the admin console
    expect(screen.queryByText("Overview")).toBeNull();
  });

  it("clears a daily dare, then switches to the Calm look with plain words", async () => {
    await signIn(email, "Smoke1234pass");
    const dare = await screen.findByRole("button", { name: /I did it/i });
    fireEvent.click(dare);
    await waitFor(() => expect(screen.getAllByRole("button", { pressed: true }).length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole("button", { name: /Switch to Calm/i }));
    expect(await screen.findAllByText(/habits/i)).not.toHaveLength(0);
    expect(document.documentElement.getAttribute("data-style")).toBe("calm");
  });

  it("shows the Hall with an opt-in, not a public list", async () => {
    await signIn(email, "Smoke1234pass");
    await screen.findAllByRole("checkbox");
    window.location.hash = "#/hall";
    expect(await screen.findByText(/Want to compete with friends/i)).toBeTruthy();
  });

  it("rejects a wrong password with a plain message", async () => {
    await signIn(email, "WrongPass999");
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("gives the admin a console that lists hunters without private text", async () => {
    await signIn("boss@example.com", "BossPass123");
    // the admin has no hunter plan yet, so the gate offers a way straight to the console
    const skip = await screen.findByRole("button", { name: /open the admin console/i });
    fireEvent.click(skip);
    const overviewLink = await screen.findAllByText("Overview");
    expect(overviewLink.length).toBeGreaterThan(0);
    fireEvent.click(overviewLink[0]);
    expect(await screen.findByText(/What this console can't show/i)).toBeTruthy();
  });
});
