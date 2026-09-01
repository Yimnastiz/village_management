"use client";

import { createContext, useCallback, useContext, useId, useLayoutEffect, useMemo, useState } from "react";

export type SuperAdminHeaderAction = {
  label: string;
  onClick: () => void;
};

export type SuperAdminHeaderContext = {
  title: string;
  description?: string;
  workspace?: {
    villageId: string;
    villageName: string;
    location: string;
    isActive: boolean;
  };
};

type HeaderRegistration = { context: SuperAdminHeaderContext; priority: number };

const SuperAdminPageHeaderContext = createContext<{
  action: SuperAdminHeaderAction | null;
  setAction: (action: SuperAdminHeaderAction | null) => void;
  context: SuperAdminHeaderContext | null;
  registerContext: (id: string, context: SuperAdminHeaderContext, priority: number) => void;
  unregisterContext: (id: string) => void;
} | null>(null);

export function SuperAdminPageHeaderProvider({ children }: { children: React.ReactNode }) {
  const [action, setAction] = useState<SuperAdminHeaderAction | null>(null);
  const [registrations, setRegistrations] = useState<Record<string, HeaderRegistration>>({});
  const registerContext = useCallback((id: string, context: SuperAdminHeaderContext, priority: number) => {
    setRegistrations((current) => ({ ...current, [id]: { context, priority } }));
  }, []);
  const unregisterContext = useCallback((id: string) => {
    setRegistrations((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);
  const context = useMemo(() => {
    const entries = Object.values(registrations).sort((left, right) => left.priority - right.priority);
    if (!entries.length) return null;
    return entries.reduce<SuperAdminHeaderContext>((merged, entry) => ({ ...merged, ...entry.context, workspace: entry.context.workspace ?? merged.workspace }), { title: "" });
  }, [registrations]);
  const value = useMemo(() => ({ action, setAction, context, registerContext, unregisterContext }), [action, context, registerContext, unregisterContext]);
  return <SuperAdminPageHeaderContext.Provider value={value}>{children}</SuperAdminPageHeaderContext.Provider>;
}

export function SuperAdminPageHeaderRegistration({ context, priority = 0 }: { context: SuperAdminHeaderContext; priority?: number }) {
  const id = useId();
  const { registerContext, unregisterContext } = useSuperAdminPageHeader();
  useLayoutEffect(() => { registerContext(id, context, priority); return () => unregisterContext(id); }, [context, id, priority, registerContext, unregisterContext]);
  return null;
}

export function useSuperAdminPageHeader() {
  const context = useContext(SuperAdminPageHeaderContext);
  if (!context) throw new Error("useSuperAdminPageHeader must be used inside SuperAdminPageHeaderProvider");
  return context;
}

export function useOptionalSuperAdminPageHeader() {
  return useContext(SuperAdminPageHeaderContext);
}
