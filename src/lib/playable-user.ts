import { createContext, useContext } from "react";

import type { PlayableUser } from "@/lib/auth";

/** Filled in by `AuthGate` once the browser has resolved the shared session. */
export const PlayableUserContext = createContext<PlayableUser | null>(null);

/** The player resolved by the gate. Only meaningful for children rendered by `AuthGate`. */
export function usePlayableAuth(): PlayableUser | null {
  return useContext(PlayableUserContext);
}
