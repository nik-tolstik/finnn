export type UserAvatarGroup = "animals" | "robots" | "fantasy";

export interface UserAvatarPreset {
  id: string;
  label: string;
  group: UserAvatarGroup;
  src: string;
}

export const USER_AVATAR_GROUP_LABELS: Record<UserAvatarGroup, string> = {
  animals: "Животные",
  robots: "Роботы",
  fantasy: "Фантазийные существа",
};

export const USER_AVATARS: readonly UserAvatarPreset[] = [
  { id: "cat-01", label: "Кот", group: "animals", src: "/avatars/animals/cat-01.svg" },
  { id: "fox-01", label: "Лис", group: "animals", src: "/avatars/animals/fox-01.svg" },
  { id: "bear-01", label: "Медведь", group: "animals", src: "/avatars/animals/bear-01.svg" },
  { id: "rabbit-01", label: "Кролик", group: "animals", src: "/avatars/animals/rabbit-01.svg" },
  { id: "panda-01", label: "Панда", group: "animals", src: "/avatars/animals/panda-01.svg" },
  { id: "lion-01", label: "Лев", group: "animals", src: "/avatars/animals/lion-01.svg" },
  { id: "koala-01", label: "Коала", group: "animals", src: "/avatars/animals/koala-01.svg" },
  { id: "owl-01", label: "Сова", group: "animals", src: "/avatars/animals/owl-01.svg" },
  { id: "dog-01", label: "Пёс", group: "animals", src: "/avatars/animals/dog-01.svg" },
  { id: "tiger-01", label: "Тигр", group: "animals", src: "/avatars/animals/tiger-01.svg" },
  { id: "robot-01", label: "Робот Спарк", group: "robots", src: "/avatars/robots/robot-01.svg" },
  { id: "robot-02", label: "Робот Бит", group: "robots", src: "/avatars/robots/robot-02.svg" },
  { id: "robot-03", label: "Робот Болт", group: "robots", src: "/avatars/robots/robot-03.svg" },
  { id: "robot-04", label: "Робот Нова", group: "robots", src: "/avatars/robots/robot-04.svg" },
  { id: "robot-05", label: "Робот Орбит", group: "robots", src: "/avatars/robots/robot-05.svg" },
  { id: "robot-06", label: "Робот Рекс", group: "robots", src: "/avatars/robots/robot-06.svg" },
  { id: "robot-07", label: "Робот Тесла", group: "robots", src: "/avatars/robots/robot-07.svg" },
  { id: "robot-08", label: "Робот Пикс", group: "robots", src: "/avatars/robots/robot-08.svg" },
  { id: "robot-09", label: "Робот Кьюб", group: "robots", src: "/avatars/robots/robot-09.svg" },
  { id: "robot-10", label: "Робот Вектор", group: "robots", src: "/avatars/robots/robot-10.svg" },
  { id: "dragon-01", label: "Дракончик", group: "fantasy", src: "/avatars/fantasy/dragon-01.svg" },
  { id: "slime-01", label: "Слайм", group: "fantasy", src: "/avatars/fantasy/slime-01.svg" },
  { id: "phoenix-01", label: "Феникс", group: "fantasy", src: "/avatars/fantasy/phoenix-01.svg" },
  { id: "griffin-01", label: "Грифон", group: "fantasy", src: "/avatars/fantasy/griffin-01.svg" },
  { id: "sprite-01", label: "Спрайт", group: "fantasy", src: "/avatars/fantasy/sprite-01.svg" },
  { id: "golem-01", label: "Голем", group: "fantasy", src: "/avatars/fantasy/golem-01.svg" },
  { id: "kirin-01", label: "Кирин", group: "fantasy", src: "/avatars/fantasy/kirin-01.svg" },
  { id: "mothling-01", label: "Мотлинг", group: "fantasy", src: "/avatars/fantasy/mothling-01.svg" },
  { id: "unicorn-01", label: "Единорог", group: "fantasy", src: "/avatars/fantasy/unicorn-01.svg" },
  { id: "kraken-01", label: "Кракен", group: "fantasy", src: "/avatars/fantasy/kraken-01.svg" },
];

const USER_AVATAR_SOURCE_SET = new Set(USER_AVATARS.map((avatar) => avatar.src));

export function isUserAvatarSrc(value: string): boolean {
  return USER_AVATAR_SOURCE_SET.has(value);
}
