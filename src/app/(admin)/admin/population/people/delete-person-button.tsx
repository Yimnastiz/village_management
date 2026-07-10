"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deletePersonAction } from "./actions";

type DeletePersonButtonProps = {
  personId: string;
};

export function DeletePersonButton({ personId }: DeletePersonButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  return (
    <Button
      variant="outline"
      className="border-red-300 text-red-700 hover:bg-red-50"
      isLoading={isLoading}
      onClick={async () => {
        const ok = window.confirm("ยืนยันการลบข้อมูลบุคคลนี้?");
        if (!ok) return;

        setIsLoading(true);
        const result = await deletePersonAction(personId);
        setIsLoading(false);

        if (!result.success) {
          window.alert(result.error);
          return;
        }

        router.push("/admin/population/people");
        router.refresh();
      }}
    >
      ลบ
    </Button>
  );
}
