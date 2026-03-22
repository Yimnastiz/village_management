"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleSaveNewsAction } from "../actions";

export function NewsSaveButton({
  newsId,
  initialSaved,
}: {
  newsId: string;
  initialSaved: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async () => {
    setIsSubmitting(true);
    setError(null);

    const result = await toggleSaveNewsAction(newsId);
    if (!result.success) {
      setError(result.error);
      setIsSubmitting(false);
      return;
    }

    setSaved(result.saved);
    setIsSubmitting(false);
    router.refresh();
  };

  return (
    <div>
      <Button
        type="button"
        variant={saved ? "secondary" : "outline"}
        size="sm"
        onClick={handleToggle}
        isLoading={isSubmitting}
      >
        {saved ? (
          <>
            <BookmarkCheck className="h-4 w-4 mr-1" /> บันทึกแล้ว
          </>
        ) : (
          <>
            <Bookmark className="h-4 w-4 mr-1" /> บันทึกข่าว
          </>
        )}
      </Button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
