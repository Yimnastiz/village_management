import Image from "next/image";
import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "h-9 w-auto",
  md: "h-12 w-auto",
  lg: "h-16 w-auto",
} as const;

type BrandLogoProps = {
  size?: keyof typeof sizeClasses;
  className?: string;
  alt?: string;
  priority?: boolean;
};

export function BrandLogo({
  size = "md",
  className,
  alt = "ระบบหมู่บ้านอัจฉริยะ",
  priority = false,
}: BrandLogoProps) {
  return (
    <Image
      src="/brand/logo.svg"
      alt={alt}
      width={210}
      height={297}
      priority={priority}
      sizes="(max-width: 640px) 36px, 48px"
      className={cn("shrink-0 object-contain", sizeClasses[size], className)}
    />
  );
}
