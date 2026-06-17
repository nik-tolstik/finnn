const USER_AVATAR_SOURCES = [
  "/avatars/animals/cat-01.svg",
  "/avatars/animals/fox-01.svg",
  "/avatars/animals/bear-01.svg",
  "/avatars/animals/rabbit-01.svg",
  "/avatars/animals/panda-01.svg",
  "/avatars/animals/lion-01.svg",
  "/avatars/animals/koala-01.svg",
  "/avatars/animals/owl-01.svg",
  "/avatars/animals/dog-01.svg",
  "/avatars/animals/tiger-01.svg",
  "/avatars/robots/robot-01.svg",
  "/avatars/robots/robot-02.svg",
  "/avatars/robots/robot-03.svg",
  "/avatars/robots/robot-04.svg",
  "/avatars/robots/robot-05.svg",
  "/avatars/robots/robot-06.svg",
  "/avatars/robots/robot-07.svg",
  "/avatars/robots/robot-08.svg",
  "/avatars/robots/robot-09.svg",
  "/avatars/robots/robot-10.svg",
  "/avatars/fantasy/dragon-01.svg",
  "/avatars/fantasy/slime-01.svg",
  "/avatars/fantasy/phoenix-01.svg",
  "/avatars/fantasy/griffin-01.svg",
  "/avatars/fantasy/sprite-01.svg",
  "/avatars/fantasy/golem-01.svg",
  "/avatars/fantasy/kirin-01.svg",
  "/avatars/fantasy/mothling-01.svg",
  "/avatars/fantasy/unicorn-01.svg",
  "/avatars/fantasy/kraken-01.svg",
] as const;

const USER_AVATAR_SOURCE_SET = new Set<string>(USER_AVATAR_SOURCES);

export function isPresetUserAvatar(value: string): boolean {
  return USER_AVATAR_SOURCE_SET.has(value);
}

export function getUploadedUserAvatarPath(userId: string): string {
  return `/auth/users/${userId}/avatar`;
}
