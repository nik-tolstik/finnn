"use client";

import { UserAvatar } from "@/shared/components/UserAvatar";

import { cn } from "../utils/cn";

interface UserDisplayProps {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { avatar: "size-3.5", text: "text-xs", gap: "gap-1" },
  md: { avatar: "size-5", text: "text-sm", gap: "gap-2" },
  lg: { avatar: "size-6", text: "text-md", gap: "gap-2" },
};

export function UserDisplay({ name, email, image, size = "sm", showName = true, className }: UserDisplayProps) {
  const ownerName = name || email || "Без владельца";

  const { text: textSize, gap: gapSize } = sizeMap[size];

  return (
    <div className={cn("flex items-center", gapSize, className)}>
      <UserAvatar name={name} email={email} image={image} size={size} fallbackClassName="font-normal" />
      {showName && <h3 className={cn(textSize, "text-foreground/75 tracking-wider")}>{ownerName}</h3>}
    </div>
  );
}
