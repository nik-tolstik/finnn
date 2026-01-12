"use client";

import Image from "next/image";

import { getAvatarColor } from "@/shared/utils/avatar-colors";

interface UserDisplayProps {
  name?: string | null;
  email?: string;
  image?: string | null;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { avatar: "h-6 w-6", text: "text-xs" },
  md: { avatar: "h-8 w-8", text: "text-sm" },
  lg: { avatar: "h-10 w-10", text: "text-base" },
};

export function UserDisplay({
  name,
  email,
  image,
  size = "sm",
  showName = true,
  className,
}: UserDisplayProps) {
  const ownerName = name || email || "Без владельца";
  const displayName = name || email || "U";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const { avatar: avatarSize, text: textSize } = sizeMap[size];

  return (
    <div className={`flex items-center gap-2 ${className || ""}`}>
      {image ? (
        <Image
          src={image}
          alt={ownerName}
          width={24}
          height={24}
          className={`${avatarSize} rounded-full object-cover`}
          unoptimized
        />
      ) : (
        <div
          className={`flex ${avatarSize} items-center justify-center rounded-full text-white ${textSize} font-medium`}
          style={{
            backgroundColor: getAvatarColor(displayName),
          }}
        >
          {initials}
        </div>
      )}
      {showName && (
        <h3 className={`${textSize} font-semibold text-muted-foreground tracking-wider`}>{ownerName}</h3>
      )}
    </div>
  );
}
