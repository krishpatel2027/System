import { useSyncExternalStore } from "react";

const noop = () => () => {};

// False during SSR and the hydration pass, true afterwards — for values that
// depend on the viewer's clock or locale and would otherwise mismatch.
export function useHydrated() {
  return useSyncExternalStore(noop, () => true, () => false);
}
