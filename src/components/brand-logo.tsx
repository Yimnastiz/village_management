import Image from "next/image";
import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "h-9 w-9",
  md: "h-12 w-12",
  lg: "h-16 w-16",
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
      src="/brand/logo.png"
      alt={alt}
      width={1254}
      height={1254}
      priority={priority}
      sizes="(max-width: 640px) 36px, 64px"
      className={cn("shrink-0 object-contain", sizeClasses[size], className)}
    />
  );
}
