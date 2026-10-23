/**
 * Cross-component registry for "this editor has unsaved changes".
 *
 * Two navigation paths have to be covered and they are not siblings in the tree:
 * the section tabs are ordinary anchors, while the collection switcher navigates
 * imperatively through router.push. A click listener alone would miss the
 * switcher, and threading a context through the admin layout for one boolean
 * costs more than this does.
 *
 * The guard component registers the handler; navigators ask before leaving.
 */

type NavigationHandler = (destination: string) => boolean;

let handler: NavigationHandler | null = null;

/** Registers the interceptor. Returns a disposer for effect cleanup. */
export function setNavigationGuard(next: NavigationHandler): () => void {
  handler = next;
  return () => {
    if (handler === next) handler = null;
  };
}

/**
 * Asks the active guard to take over navigating to `destination`.
 * Returns true when it did, in which case the caller must not navigate.
 */
export function requestNavigation(destination: string): boolean {
  return handler ? handler(destination) : false;
}
