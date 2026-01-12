"use client";

import Image from "next/image";

import { getAvatarColor } from "@/shared/utils/avatar-colors";

import { cn } from "../utils/cn";

interface UserDisplayProps {
  name?: string | null;
  email?: string;
  image?: string | null;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { avatar: "h-4 w-4", text: "text-xs", gap: "gap-1" },
  md: { avatar: "h-6 w-6", text: "text-sm", gap: "gap-2" },
  lg: { avatar: "h-10 w-10", text: "text-base", gap: "gap-2" },
};

export function UserDisplay({ name, email, image, size = "sm", showName = true, className }: UserDisplayProps) {
  const ownerName = name || email || "Без владельца";
  const displayName = name || email || "U";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const { avatar: avatarSize, text: textSize, gap: gapSize } = sizeMap[size];

  return (
    <div className={cn("flex items-center", gapSize, className)}>
      {image ? (
        <Image
          src={image}
          alt={ownerName}
          width={24}
          height={24}
          className={cn(avatarSize, "rounded-full object-cover")}
          unoptimized
        />
      ) : (
        <div
          className={cn("flex items-center justify-center rounded-full text-white font-medium", avatarSize, textSize)}
          style={{
            backgroundColor: getAvatarColor(displayName),
          }}
        >
          {initials}
        </div>
      )}
      {showName && <h3 className={cn(textSize, "font-semibold text-muted-foreground tracking-wider")}>{ownerName}</h3>}
    </div>
  );
}
