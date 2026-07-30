import { getApiBaseUrl } from "@/shared/api/http-client";
import { getUploadedAvatarVersion, isUploadedAvatarPath } from "@/shared/lib/avatar-cache-bust";
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

const sizeMap: Record<UserAvatarSize, { container: string; text: string }> = {
  sm: { container: "size-5", text: "text-[10px]" },
  md: { container: "size-6", text: "text-xs" },
  lg: { container: "size-8", text: "text-sm" },
  xl: { container: "size-12", text: "text-lg" },
  "2xl": { container: "size-20", text: "text-2xl" },
};

function resolveImageSrc(image: string): string {
  if (isUploadedAvatarPath(image)) {
    const url = new URL(image, `${getApiBaseUrl()}/`);
    const version = getUploadedAvatarVersion(image);
    if (version) {
      url.searchParams.set("v", version);
    }

    return url.toString();
  }

  return image;
}

function isPresetAvatarSrc(image: string): boolean {
  return image.startsWith("/avatars/");
}

export function UserAvatar({ name, email, image, size = "md", className, fallbackClassName }: UserAvatarProps) {
  const displayName = name || email || "U";
  const initial = displayName.trim().charAt(0).toUpperCase() || "U";
  const { container, text } = sizeMap[size];
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
        <img src={resolvedImage} alt={`${displayName} avatar`} className="size-full object-cover" />
      ) : resolvedImage ? (
        <img src={resolvedImage} alt={`${displayName} avatar`} className="size-full object-cover" />
      ) : (
        <span className={cn("leading-none font-medium", fallbackClassName)}>{initial}</span>
      )}
    </div>
  );
}
