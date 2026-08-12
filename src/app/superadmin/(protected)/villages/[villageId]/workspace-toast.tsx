"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/toast";

export function WorkspaceToast() {
  const params = useSearchParams();
  const toast = useToast();
  const shown = useRef<string | null>(null);
  const message = params.get("success");
  useEffect(() => {
    if (message && shown.current !== message) {
      shown.current = message;
      toast.success(message);
    }
  }, [message, toast]);
  return null;
}
