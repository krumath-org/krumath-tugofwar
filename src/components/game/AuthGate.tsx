import { createClientOnlyFn } from "@tanstack/react-start";
import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { clientAuthState, type PlayableAuthState } from "@/lib/auth";
import { km } from "@/lib/copy-km";
import { signInHref } from "@/lib/host-urls";
import { PlayableUserContext } from "@/lib/playable-user";

/**
 * Resolving the session needs browser storage, so this is client-only — which also keeps
 * the `supabase.client` module out of the server bundle.
 */
const resolvePlayableAuth = createClientOnlyFn(async (): Promise<PlayableAuthState> => {
  const { getBrowserUser } = await import("@/lib/supabase.client");
  return clientAuthState(await getBrowserUser());
});

type AuthGateProps = {
  /** Outcome of the route's `beforeLoad`, which the server can only ever report as `unknown`. */
  initial: PlayableAuthState;
  children: ReactNode;
};

/**
 * Nothing inside the game renders until a KruMath account is confirmed.
 *
 * SSR reports `unknown` because krumath.com keeps its session in localStorage, which the
 * Worker cannot read. The browser resolves that here and redirects only when the absence
 * of a session is conclusive, so a signed-out visitor sees a spinner rather than a flash
 * of the game, and a signed-in player is never bounced.
 */
export function AuthGate({ initial, children }: AuthGateProps) {
  const [state, setState] = useState<PlayableAuthState>(initial);

  useEffect(() => {
    if (state.status !== "unknown") return;
    let cancelled = false;

    void (async () => {
      // A session that cannot be read is treated as signed out: failing closed beats
      // leaving the player on a spinner forever.
      const resolved = await resolvePlayableAuth().catch(() => null);
      if (cancelled) return;
      if (resolved && resolved.status === "authenticated") {
        setState(resolved);
        return;
      }
      window.location.replace(signInHref());
    })();

    return () => {
      cancelled = true;
    };
  }, [state.status]);

  if (state.status === "authenticated") {
    return (
      <PlayableUserContext.Provider value={state.user}>{children}</PlayableUserContext.Provider>
    );
  }

  return (
    <main
      role="status"
      aria-live="polite"
      className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-sm text-muted-foreground"
    >
      <Loader2 className="size-5 animate-spin" aria-hidden="true" />
      <span>{km.authChecking}</span>
    </main>
  );
}
