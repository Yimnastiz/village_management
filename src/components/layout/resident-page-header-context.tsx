"use client";

import { createContext, useCallback, useContext, useId, useLayoutEffect, useMemo, useState } from "react";

export type ResidentPageHeader = { title: string; description?: string };
type Registration = { context: ResidentPageHeader; priority: number };

type ResidentPageHeaderRegistry = {
  register: (id: string, context: ResidentPageHeader, priority: number) => void;
  unregister: (id: string) => void;
};

const ResidentPageHeaderContext = createContext<ResidentPageHeader | null>(null);
const ResidentPageHeaderRegistryContext = createContext<ResidentPageHeaderRegistry | null>(null);

/** Route-owned page context for the Resident top bar. */
export function ResidentPageHeaderProvider({ children }: { children: React.ReactNode }) {
  const [registrations, setRegistrations] = useState<Record<string, Registration>>({});
  const register = useCallback((id: string, context: ResidentPageHeader, priority: number) => {
    setRegistrations((current) => {
      const existing = current[id];
      if (existing?.priority === priority && existing.context.title === context.title && existing.context.description === context.description) {
        return current;
      }
      return { ...current, [id]: { context, priority } };
    });
  }, []);
  const unregister = useCallback((id: string) => {
    setRegistrations((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);
  const header = useMemo(() => {
    const entries = Object.values(registrations).sort((left, right) => left.priority - right.priority);
    return entries.length ? entries[entries.length - 1].context : null;
  }, [registrations]);
  const registry = useMemo(() => ({ register, unregister }), [register, unregister]);

  return (
    <ResidentPageHeaderRegistryContext.Provider value={registry}>
      <ResidentPageHeaderContext.Provider value={header}>{children}</ResidentPageHeaderContext.Provider>
    </ResidentPageHeaderRegistryContext.Provider>
  );
}

export function ResidentPageHeaderRegistration({ context, priority = 0 }: { context: ResidentPageHeader; priority?: number }) {
  const id = useId();
  const registry = useOptionalResidentPageHeaderRegistry();
  const { title, description } = context;

  useLayoutEffect(() => {
    if (!registry) return;
    registry.register(id, { title, description }, priority);
    return () => registry.unregister(id);
  }, [description, id, priority, registry, title]);

  return null;
}

export function useOptionalResidentPageHeader() {
  return useContext(ResidentPageHeaderContext);
}

export function useOptionalResidentPageHeaderRegistry() {
  return useContext(ResidentPageHeaderRegistryContext);
}
