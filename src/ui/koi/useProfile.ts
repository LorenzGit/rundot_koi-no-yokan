import { useSyncExternalStore } from "react";
import { getProfile, subscribeProfile, type Profile } from "../../state/profile.ts";

/** Subscribe a component to the persistent profile. */
export function useProfile<T = Profile>(selector: (p: Profile) => T = (p) => p as unknown as T): T {
    return useSyncExternalStore(subscribeProfile, () => selector(getProfile()));
}
