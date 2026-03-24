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
}

export function SaveButton({
  itemId,
  initialSaved,
  toggleAction,
  label = "บันทึก",
  savedLabel = "บันทึกแล้ว",
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
      >
        {saved ? (
          <>
            <BookmarkCheck className="mr-1 h-4 w-4" /> {savedLabel}
          </>
        ) : (
          <>
            <Bookmark className="mr-1 h-4 w-4" /> {label}
          </>
        )}
      </Button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
