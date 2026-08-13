"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

type ToggleFn = (id: string) => Promise<{ success: true; saved: boolean } | { success: false; error: string }>;

interface SaveButtonProps {
  itemId: string;
  initialSaved: boolean;
  toggleAction: ToggleFn;
  label?: string;
  savedLabel?: string;
  compact?: boolean;
  ariaLabel?: string;
  savedAriaLabel?: string;
}

export function SaveButton({
  itemId,
  initialSaved,
  toggleAction,
  label = "บันทึก",
  savedLabel = "บันทึกแล้ว",
  compact = false,
  ariaLabel,
  savedAriaLabel,
}: SaveButtonProps) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async () => {
    setIsPending(true);
    setError(null);
    const result = await toggleAction(itemId);
    if (!result.success) {
      setError(result.error);
      setIsPending(false);
      return;
    }
    setSaved(result.saved);
    setIsPending(false);
    router.refresh();
  };

  return (
    <div>
      <Button
        type="button"
        variant={saved ? "secondary" : "outline"}
        size="sm"
        onClick={handleToggle}
        isLoading={isPending}
        aria-label={saved ? (savedAriaLabel ?? savedLabel) : (ariaLabel ?? label)}
        title={saved ? (savedAriaLabel ?? savedLabel) : (ariaLabel ?? label)}
        className={compact ? "h-10 w-10 shrink-0 p-0" : undefined}
      >
        {saved ? (
          <>
            <BookmarkCheck className={compact ? "h-4 w-4" : "mr-1 h-4 w-4"} /> {!compact && savedLabel}
          </>
        ) : (
          <>
            <Bookmark className={compact ? "h-4 w-4" : "mr-1 h-4 w-4"} /> {!compact && label}
          </>
        )}
      </Button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
