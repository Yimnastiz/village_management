import type { ReactNode } from "react";

/**
 * Lets a list toolbar attach to the workspace Topbar while the shared layout
 * continues to provide comfortable padding to normal detail pages.
 */
export function WorkspaceListPage({ children }: { children: ReactNode }) {
  return <div className="-mt-4 sm:-mt-6">{children}</div>;
}
