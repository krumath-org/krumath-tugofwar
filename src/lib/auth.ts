import { createIsomorphicFn } from "@tanstack/react-start";

export type PlayableUser = { id: string };

/**
 * Tri-state view of "may this visitor play?".
 *
 * `unknown` is deliberately not a synonym for signed out. krumath.com keeps its Supabase
 * session in localStorage, which never reaches the Worker, so a request with no session
 * cookie proves nothing about the visitor. Only the browser can resolve `unknown`.
 */
export type PlayableAuthState =
  | { status: "authenticated"; user: PlayableUser }
  | { status: "unauthenticated" }
  | { status: "unknown" };

/** The bits of a Supabase user this gate cares about. */
type SessionUser = { id: string; is_anonymous?: boolean } | null | undefined;

function toPlayableUser(user: SessionUser): PlayableUser | null {
  if (!user) return null;
  if (user.is_anonymous) return null;
  return { id: user.id };
}

/**
 * Client outcome. The browser can read the shared localStorage session, so a missing
 * session is conclusive.
 */
export function clientAuthState(user: SessionUser): PlayableAuthState {
  const playable = toPlayableUser(user);
  return playable ? { status: "authenticated", user: playable } : { status: "unauthenticated" };
}

/**
 * Server outcome. Cookies are the only credential the Worker can see, and krumath.com
 * keeps its session in localStorage, so "no user" proves nothing. Reporting
 * `unauthenticated` here is what bounced signed-in players back to /sign-in.
 */
export function serverAuthState(user: SessionUser): PlayableAuthState {
  const playable = toPlayableUser(user);
  return playable ? { status: "authenticated", user: playable } : { status: "unknown" };
}

function hasSupabaseEnv(): boolean {
  const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
  const key = import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined;
  return Boolean(url && key);
}

/**
 * Probe the KruMath session.
 *
 * The server branch only ever inspects cookies (a leftover mechanism the main site still
 * uses for email/OTP callbacks); the browser branch reads the shared localStorage session
 * that the normal sign-in flow writes.
 */
export const fetchPlayableAuth = createIsomorphicFn()
  .server(async (): Promise<PlayableAuthState> => {
    if (!hasSupabaseEnv()) return { status: "unknown" };
    const { createSupabaseServerClient } = await import("@/lib/supabase.server");
    const { data, error } = await createSupabaseServerClient().auth.getUser();
    if (error) return { status: "unknown" };
    return serverAuthState(data.user);
  })
  .client(async (): Promise<PlayableAuthState> => {
    const { getBrowserUser } = await import("@/lib/supabase.client");
    return clientAuthState(await getBrowserUser());
  });
