"use client";

import { createContext, useCallback, useContext, useId, useLayoutEffect, useMemo, useState } from "react";

export type AdminPageHeader = { title: string; description?: string };
type Registration = { context: AdminPageHeader; priority: number };

type AdminPageHeaderRegistry = {
  register: (id: string, context: AdminPageHeader, priority: number) => void;
  unregister: (id: string) => void;
};

const AdminPageHeaderContext = createContext<AdminPageHeader | null>(null);
const AdminPageHeaderRegistryContext = createContext<AdminPageHeaderRegistry | null>(null);

export function AdminPageHeaderProvider({ children }: { children: React.ReactNode }) {
  const [registrations, setRegistrations] = useState<Record<string, Registration>>({});
  const register = useCallback((id: string, context: AdminPageHeader, priority: number) => setRegistrations((current) => {
    const existing = current[id];
    if (existing?.priority === priority && existing.context.title === context.title && existing.context.description === context.description) return current;
    return { ...current, [id]: { context, priority } };
  }), []);
  const unregister = useCallback((id: string) => setRegistrations((current) => {
    if (!current[id]) return current;
    const next = { ...current };
    delete next[id];
    return next;
  }), []);
  const context = useMemo(() => {
    const entries = Object.values(registrations).sort((left, right) => left.priority - right.priority);
    return entries.length ? entries[entries.length - 1].context : null;
  }, [registrations]);
  const registry = useMemo(() => ({ register, unregister }), [register, unregister]);
  return (
    <AdminPageHeaderRegistryContext.Provider value={registry}>
      <AdminPageHeaderContext.Provider value={context}>{children}</AdminPageHeaderContext.Provider>
    </AdminPageHeaderRegistryContext.Provider>
  );
}

export function AdminPageHeaderRegistration({ context, priority = 0 }: { context: AdminPageHeader; priority?: number }) {
  const id = useId();
  const pageHeaderRegistry = useOptionalAdminPageHeaderRegistry();
  useLayoutEffect(() => {
    if (!pageHeaderRegistry) return;
    pageHeaderRegistry.register(id, context, priority);
    return () => pageHeaderRegistry.unregister(id);
  }, [context, id, pageHeaderRegistry, priority]);
  return null;
}

export function useOptionalAdminPageHeader() {
  return useContext(AdminPageHeaderContext);
}

export function useOptionalAdminPageHeaderRegistry() {
  return useContext(AdminPageHeaderRegistryContext);
}
