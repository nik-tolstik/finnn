"use client";

import Image from "next/image";

import { getApiBaseUrl } from "@/shared/api/http-client";
import { getAvatarColor } from "@/shared/utils/avatar-colors";
import { cn } from "@/shared/utils/cn";

type UserAvatarSize = "sm" | "md" | "lg" | "xl" | "2xl";

interface UserAvatarProps {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  size?: UserAvatarSize;
  className?: string;
  fallbackClassName?: string;
}

const sizeMap: Record<UserAvatarSize, { container: string; text: string; pixels: number }> = {
  sm: { container: "size-5", text: "text-[10px]", pixels: 20 },
  md: { container: "size-6", text: "text-xs", pixels: 24 },
  lg: { container: "size-8", text: "text-sm", pixels: 32 },
  xl: { container: "size-12", text: "text-lg", pixels: 48 },
  "2xl": { container: "size-20", text: "text-2xl", pixels: 80 },
};

function resolveImageSrc(image: string): string {
  if (image.startsWith("/auth/")) {
    return new URL(image, `${getApiBaseUrl()}/`).toString();
  }

  return image;
}

function isPresetAvatarSrc(image: string): boolean {
  return image.startsWith("/avatars/");
}

export function UserAvatar({ name, email, image, size = "md", className, fallbackClassName }: UserAvatarProps) {
  const displayName = name || email || "U";
  const initial = displayName.trim().charAt(0).toUpperCase() || "U";
  const { container, text, pixels } = sizeMap[size];
  const resolvedImage = image ? resolveImageSrc(image) : null;

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full",
        container,
        !image && "flex items-center justify-center text-white",
        text,
        className
      )}
      style={!image ? { backgroundColor: getAvatarColor(displayName) } : undefined}
      aria-hidden="true"
    >
      {resolvedImage && image && isPresetAvatarSrc(image) ? (
        <Image
          src={resolvedImage}
          alt={`${displayName} avatar`}
          fill
          sizes={`${pixels}px`}
          className="object-cover"
          unoptimized
        />
      ) : resolvedImage ? (
        // biome-ignore lint/performance/noImgElement: Uploaded and external avatar URLs are intentionally not routed through Next Image.
        <img src={resolvedImage} alt={`${displayName} avatar`} className="size-full object-cover" />
      ) : (
        <span className={cn("leading-none font-medium", fallbackClassName)}>{initial}</span>
      )}
    </div>
  );
}
