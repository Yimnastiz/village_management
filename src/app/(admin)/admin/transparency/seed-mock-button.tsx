"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { seedMockTransparencyAction } from "./actions";

export function SeedMockTransparencyButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSeed = async () => {
    setIsLoading(true);
    setMessage(null);
    setError(null);

    const result = await seedMockTransparencyAction();
    if (!result.success) {
      setError(result.error);
      setIsLoading(false);
      return;
    }

    setMessage(`สร้างข้อมูลตัวอย่าง ${result.created} รายการ`);
    setIsLoading(false);
    router.refresh();
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="outline" onClick={handleSeed} isLoading={isLoading}>
        <Database className="h-4 w-4 mr-1" /> สร้างข้อมูล mock
      </Button>
      {message && <p className="text-xs text-green-600">{message}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
