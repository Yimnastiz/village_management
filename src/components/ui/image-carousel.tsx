"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type ImageCarouselProps = {
  images: string[];
  altPrefix: string;
};

export function ImageCarousel({ images, altPrefix }: ImageCarouselProps) {
  const [index, setIndex] = useState(0);

  if (images.length === 0) return null;

  const prev = () => setIndex((current) => (current - 1 + images.length) % images.length);
  const next = () => setIndex((current) => (current + 1) % images.length);

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[index]}
          alt={`${altPrefix} ${index + 1}`}
          className="w-full max-h-[420px] object-cover"
        />

        {images.length > 1 && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {images.map((url, thumbnailIndex) => (
            <button
              key={`${url}-${thumbnailIndex}`}
              type="button"
              onClick={() => setIndex(thumbnailIndex)}
              className={`rounded-md overflow-hidden border ${
                thumbnailIndex === index ? "border-green-500" : "border-gray-200"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`${altPrefix} thumb ${thumbnailIndex + 1}`} className="h-14 w-20 object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
