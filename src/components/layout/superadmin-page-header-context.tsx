"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type SuperAdminHeaderAction = {
  label: string;
  onClick: () => void;
};

export type SuperAdminHeaderContext = {
  title: string;
  description?: string;
};

const SuperAdminPageHeaderContext = createContext<{
  action: SuperAdminHeaderAction | null;
  setAction: (action: SuperAdminHeaderAction | null) => void;
  context: SuperAdminHeaderContext | null;
  setContext: (context: SuperAdminHeaderContext | null) => void;
} | null>(null);

export function SuperAdminPageHeaderProvider({ children }: { children: React.ReactNode }) {
  const [action, setAction] = useState<SuperAdminHeaderAction | null>(null);
  const [context, setContext] = useState<SuperAdminHeaderContext | null>(null);
  const value = useMemo(() => ({ action, setAction, context, setContext }), [action, context]);
  return <SuperAdminPageHeaderContext.Provider value={value}>{children}</SuperAdminPageHeaderContext.Provider>;
}

export function SuperAdminPageHeaderRegistration({ context }: { context: SuperAdminHeaderContext }) {
  const { setContext } = useSuperAdminPageHeader();
  useEffect(() => { setContext(context); return () => setContext(null); }, [context, setContext]);
  return null;
}

export function useSuperAdminPageHeader() {
  const context = useContext(SuperAdminPageHeaderContext);
  if (!context) throw new Error("useSuperAdminPageHeader must be used inside SuperAdminPageHeaderProvider");
  return context;
}
