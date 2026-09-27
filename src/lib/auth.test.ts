import { describe, expect, it } from "vitest";

import { clientAuthState, serverAuthState } from "./auth";

describe("clientAuthState", () => {
  it("accepts a signed-in account", () => {
    expect(clientAuthState({ id: "user-1" })).toEqual({
      status: "authenticated",
      user: { id: "user-1" },
    });
  });

  // The browser can read the shared localStorage session, so "no session" is final here.
  it("treats a missing session as unauthenticated", () => {
    expect(clientAuthState(null)).toEqual({ status: "unauthenticated" });
  });

  it("treats an anonymous session as unauthenticated", () => {
    expect(clientAuthState({ id: "anon-1", is_anonymous: true })).toEqual({
      status: "unauthenticated",
    });
  });
});

describe("serverAuthState", () => {
  // Regression guard for the production outage: the Worker sees cookies only, and
  // krumath.com keeps its session in localStorage, so a missing cookie session must never
  // be reported as signed out.
  it("reports a missing cookie session as unknown, never unauthenticated", () => {
    expect(serverAuthState(null)).toEqual({ status: "unknown" });
    expect(serverAuthState(undefined)).toEqual({ status: "unknown" });
  });

  it("reports an anonymous cookie session as unknown", () => {
    expect(serverAuthState({ id: "anon-1", is_anonymous: true })).toEqual({ status: "unknown" });
  });

  it("still vouches for a genuine cookie session", () => {
    expect(serverAuthState({ id: "user-1" })).toEqual({
      status: "authenticated",
      user: { id: "user-1" },
    });
  });
});
