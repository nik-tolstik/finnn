"use client";

import { getAvatarColor } from "@/shared/utils/avatar-colors";

import { cn } from "../utils/cn";

interface UserDisplayProps {
  name?: string | null;
  email?: string;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { avatar: "size-5", text: "text-[10px]", gap: "gap-1" },
  md: { avatar: "size-6", text: "text-xs", gap: "gap-2" },
  lg: { avatar: "size-8", text: "text-sm", gap: "gap-2" },
};

export function UserDisplay({ name, email, size = "sm", showName = true, className }: UserDisplayProps) {
  const ownerName = name || email || "Без владельца";
  const displayName = name || email || "U";
  const initial = displayName.trim().charAt(0).toUpperCase() || "U";

  const { avatar: avatarSize, text: textSize, gap: gapSize } = sizeMap[size];

  return (
    <div className={cn("flex items-center", gapSize, className)}>
      <div
        className={cn(
          avatarSize,
          textSize,
          "flex items-center justify-center rounded-full text-white leading-none font-normal"
        )}
        style={{
          backgroundColor: getAvatarColor(displayName),
        }}
      >
        {initial}
      </div>
      {showName && <h3 className={cn(textSize, "font-semibold text-muted-foreground tracking-wider")}>{ownerName}</h3>}
    </div>
  );
}
