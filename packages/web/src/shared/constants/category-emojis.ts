export type CategoryEmoji = {
  emoji: string;
  tags: readonly string[];
};

export type CategoryEmojiGroup = {
  label: string;
  emojis: readonly CategoryEmoji[];
};

const emoji = (value: string, ...tags: string[]): CategoryEmoji => ({ emoji: value, tags });

export function normalizeCategoryEmojiSearch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("ru-RU")
    .trim()
    .replace(/\s+/g, " ");
}

export function filterCategoryEmojiGroups(groups: readonly CategoryEmojiGroup[], query: string): CategoryEmojiGroup[] {
  const normalizedQuery = normalizeCategoryEmojiSearch(query);

  return groups
    .map((group) => ({
      ...group,
      emojis: group.emojis.filter((item) => {
        if (!normalizedQuery) return true;

        return [item.emoji, group.label, ...item.tags]
          .map(normalizeCategoryEmojiSearch)
          .some((value) => value.includes(normalizedQuery));
      }),
    }))
    .filter((group) => group.emojis.length > 0);
}

export const CATEGORY_EMOJI_GROUPS: readonly CategoryEmojiGroup[] = [
  {
    label: "Финансы",
    emojis: [
      emoji("💰", "money", "cash", "деньги", "наличные"),
      emoji("💵", "dollar", "money", "cash", "доллар", "деньги", "наличные"),
      emoji("💶", "euro", "money", "евро", "деньги"),
      emoji("💷", "pound", "money", "фунт", "деньги"),
      emoji("💴", "yen", "money", "иена", "деньги"),
      emoji("🪙", "coin", "coins", "money", "монета", "монеты"),
      emoji("💳", "card", "bank", "карта", "банк"),
      emoji("🏦", "bank", "finance", "банк", "финансы"),
      emoji("🏧", "atm", "cash", "банкомат", "наличные"),
      emoji("📈", "growth", "income", "прибыль", "рост", "доход"),
      emoji("📉", "loss", "expense", "убыток", "расход"),
      emoji("💼", "salary", "work", "job", "зарплата", "работа"),
      emoji("🧾", "receipt", "bill", "чек", "счёт", "квитанция"),
      emoji("🐷", "savings", "piggy bank", "копилка", "сбережения"),
      emoji("💸", "payment", "expense", "платёж", "расход"),
      emoji("🤑", "rich", "money", "богатство", "деньги"),
      emoji("💎", "value", "luxury", "ценность", "роскошь"),
      emoji("🔖", "discount", "coupon", "скидка", "купон"),
      emoji("🎟️", "ticket", "coupon", "билет", "купон"),
    ],
  },
  {
    label: "Еда",
    emojis: [
      emoji("🛒", "groceries", "shopping", "cart", "продукты", "магазин", "корзина", "покупки"),
      emoji("🍎", "fruit", "apple", "фрукты", "яблоко"),
      emoji("🍏", "fruit", "apple", "фрукты", "яблоко"),
      emoji("🍊", "fruit", "orange", "фрукты", "апельсин"),
      emoji("🍋", "fruit", "lemon", "фрукты", "лимон"),
      emoji("🍌", "fruit", "banana", "фрукты", "банан"),
      emoji("🍇", "fruit", "grapes", "фрукты", "виноград"),
      emoji("🥕", "vegetable", "healthy", "овощи", "здоровая еда"),
      emoji("🥦", "vegetable", "healthy", "овощи", "брокколи"),
      emoji("🍞", "bread", "bakery", "хлеб", "выпечка"),
      emoji("🥚", "eggs", "breakfast", "яйца", "завтрак"),
      emoji("🥛", "milk", "dairy", "молоко", "молочные продукты"),
      emoji("🍽️", "food", "meal", "еда", "питание"),
      emoji("🍴", "food", "restaurant", "еда", "ресторан"),
      emoji("☕", "coffee", "cafe", "кофе", "кафе"),
      emoji("🍔", "burger", "fast food", "бургер", "фастфуд"),
      emoji("🍕", "pizza", "fast food", "пицца", "фастфуд"),
      emoji("🌭", "hot dog", "fast food", "хотдог", "фастфуд"),
      emoji("🌮", "taco", "mexican", "тако", "мексиканская еда"),
      emoji("🍜", "noodles", "soup", "лапша", "суп"),
      emoji("🍣", "sushi", "japanese", "суши", "японская еда"),
      emoji("🍰", "cake", "dessert", "торт", "десерт"),
      emoji("🍦", "ice cream", "dessert", "мороженое", "десерт"),
      emoji("🍫", "chocolate", "sweet", "шоколад", "сладкое"),
      emoji("🍷", "wine", "alcohol", "вино", "алкоголь"),
      emoji("🍺", "beer", "alcohol", "пиво", "алкоголь"),
    ],
  },
  {
    label: "Транспорт",
    emojis: [
      emoji("🚗", "car", "auto", "машина", "автомобиль"),
      emoji("🚙", "car", "suv", "машина", "автомобиль"),
      emoji("🚕", "taxi", "такси"),
      emoji("🚌", "bus", "public transport", "автобус", "транспорт"),
      emoji("🚎", "trolleybus", "public transport", "троллейбус", "транспорт"),
      emoji("🚋", "tram", "public transport", "трамвай", "транспорт"),
      emoji("🚇", "metro", "subway", "метро"),
      emoji("🚆", "train", "railway", "поезд", "железная дорога"),
      emoji("🚂", "train", "locomotive", "поезд", "паровоз"),
      emoji("🚲", "bike", "bicycle", "велосипед"),
      emoji("🛴", "scooter", "самокат"),
      emoji("🏍️", "motorcycle", "мотоцикл"),
      emoji("🚚", "truck", "delivery", "грузовик", "доставка"),
      emoji("🚐", "van", "minibus", "микроавтобус"),
      emoji("✈️", "plane", "flight", "самолёт", "перелёт"),
      emoji("🛫", "departure", "flight", "вылет", "перелёт"),
      emoji("🛬", "arrival", "flight", "прилёт", "перелёт"),
      emoji("🚢", "ship", "cruise", "корабль", "круиз"),
      emoji("⛽", "fuel", "gas", "бензин", "топливо"),
      emoji("🅿️", "parking", "парковка"),
    ],
  },
  {
    label: "Дом",
    emojis: [
      emoji("🏠", "home", "house", "дом", "жильё"),
      emoji("🏡", "home", "garden", "дом", "дача"),
      emoji("🏢", "apartment", "office", "квартира", "офис"),
      emoji("🛋️", "furniture", "sofa", "мебель", "диван"),
      emoji("🛏️", "bedroom", "sleep", "спальня", "сон"),
      emoji("🚿", "shower", "bathroom", "душ", "ванная"),
      emoji("🛁", "bath", "bathroom", "ванна", "ванная"),
      emoji("🚽", "toilet", "bathroom", "туалет", "ванная"),
      emoji("🧹", "cleaning", "housework", "уборка", "дом"),
      emoji("🧺", "laundry", "washing", "стирка", "бельё"),
      emoji("🧼", "soap", "cleaning", "мыло", "уборка"),
      emoji("🧻", "paper", "household", "бумага", "быт"),
      emoji("🔑", "key", "rent", "ключ", "аренда"),
      emoji("🔒", "security", "lock", "безопасность", "замок"),
      emoji("🛠️", "repair", "tools", "ремонт", "инструменты"),
      emoji("🔨", "repair", "construction", "ремонт", "стройка"),
      emoji("💡", "electricity", "light", "электричество", "свет"),
      emoji("🔥", "heating", "fire", "отопление", "огонь"),
      emoji("💧", "water", "utility", "вода", "коммунальные"),
      emoji("🗑️", "trash", "waste", "мусор", "отходы"),
    ],
  },
  {
    label: "Покупки",
    emojis: [
      emoji("🛍️", "shopping", "bags", "покупки", "магазин"),
      emoji("👕", "clothes", "shirt", "одежда", "футболка"),
      emoji("👚", "clothes", "fashion", "одежда", "мода"),
      emoji("👖", "clothes", "jeans", "одежда", "джинсы"),
      emoji("👟", "shoes", "sneakers", "обувь", "кроссовки"),
      emoji("👠", "shoes", "fashion", "обувь", "туфли"),
      emoji("🧥", "clothes", "coat", "одежда", "пальто"),
      emoji("🎒", "bag", "school", "рюкзак", "школа"),
      emoji("👜", "bag", "fashion", "сумка", "мода"),
      emoji("💍", "jewelry", "ring", "украшения", "кольцо"),
      emoji("⌚", "watch", "accessory", "часы", "аксессуары"),
      emoji("📱", "phone", "mobile", "телефон", "мобильный"),
      emoji("💻", "computer", "laptop", "remote work", "компьютер", "ноутбук", "удалённая работа"),
      emoji("🎧", "headphones", "audio", "music", "наушники", "аудио", "музыка"),
      emoji("📷", "camera", "photo", "камера", "фото"),
      emoji("🧸", "toy", "gift", "игрушка", "подарок"),
      emoji("🎁", "gift", "present", "подарок"),
      emoji("📦", "package", "delivery", "посылка", "доставка"),
    ],
  },
  {
    label: "Работа и учёба",
    emojis: [
      emoji("🧑‍💼", "employee", "office", "сотрудник", "офис"),
      emoji("👩‍💻", "developer", "work", "разработчик", "работа"),
      emoji("🧑‍🏫", "teacher", "education", "учитель", "образование"),
      emoji("🏫", "school", "education", "школа", "образование"),
      emoji("🎓", "university", "graduation", "университет", "выпускной"),
      emoji("📚", "books", "study", "книги", "учёба"),
      emoji("📖", "book", "reading", "книга", "чтение"),
      emoji("✏️", "pencil", "stationery", "карандаш", "канцелярия"),
      emoji("🖊️", "pen", "stationery", "ручка", "канцелярия"),
      emoji("📓", "notebook", "study", "блокнот", "учёба"),
      emoji("📅", "calendar", "planning", "календарь", "планирование"),
      emoji("📌", "task", "pin", "задача", "дела"),
      emoji("🗂️", "documents", "files", "документы", "файлы"),
      emoji("📊", "analytics", "chart", "аналитика", "график"),
      emoji("🧑‍🔧", "worker", "repair", "рабочий", "ремонт"),
      emoji("🤝", "business", "deal", "бизнес", "сделка"),
    ],
  },
  {
    label: "Здоровье",
    emojis: [
      emoji("❤️", "health", "love", "здоровье", "сердце"),
      emoji("🩺", "doctor", "medicine", "врач", "медицина"),
      emoji("🏥", "hospital", "clinic", "больница", "клиника"),
      emoji("💊", "medicine", "pills", "лекарства", "таблетки"),
      emoji("🩹", "first aid", "bandage", "первая помощь", "пластырь"),
      emoji("🦷", "dentist", "teeth", "стоматолог", "зубы"),
      emoji("👓", "glasses", "vision", "очки", "зрение"),
      emoji("🧠", "mental health", "mind", "ментальное здоровье", "психика"),
      emoji("🧘", "meditation", "wellness", "медитация", "здоровье"),
      emoji("🏋️", "gym", "fitness", "спортзал", "фитнес"),
      emoji("🏃", "running", "sport", "бег", "спорт"),
      emoji("🚴", "cycling", "sport", "велоспорт", "спорт"),
      emoji("⚽", "football", "sport", "футбол", "спорт"),
      emoji("🏀", "basketball", "sport", "баскетбол", "спорт"),
      emoji("🎾", "tennis", "sport", "теннис", "спорт"),
      emoji("🏊", "swimming", "sport", "плавание", "спорт"),
      emoji("🧴", "care", "cosmetics", "уход", "косметика"),
    ],
  },
  {
    label: "Досуг",
    emojis: [
      emoji("🎮", "games", "gaming", "игры", "гейминг"),
      emoji("🎬", "cinema", "movie", "кино", "фильм"),
      emoji("🎵", "music", "song", "музыка", "песня"),
      emoji("🎤", "concert", "singing", "концерт", "пение"),
      emoji("🎸", "guitar", "music", "гитара", "музыка"),
      emoji("🎹", "piano", "music", "пианино", "музыка"),
      emoji("🎨", "art", "painting", "искусство", "рисование"),
      emoji("🖼️", "museum", "art", "музей", "искусство"),
      emoji("📺", "tv", "subscriptions", "телевизор", "подписки"),
      emoji("📻", "radio", "music", "радио", "музыка"),
      emoji("🎲", "board games", "games", "настольные игры", "игры"),
      emoji("♟️", "chess", "games", "шахматы", "игры"),
      emoji("🎳", "bowling", "entertainment", "боулинг", "развлечения"),
      emoji("🎭", "theater", "show", "театр", "шоу"),
      emoji("🎪", "circus", "show", "цирк", "шоу"),
      emoji("🎡", "amusement park", "rides", "парк аттракционов", "аттракционы"),
      emoji("🏖️", "beach", "vacation", "пляж", "отпуск"),
      emoji("⛺", "camping", "outdoors", "кемпинг", "природа"),
      emoji("🎣", "fishing", "hobby", "рыбалка", "хобби"),
      emoji("📸", "photo", "hobby", "фото", "хобби"),
    ],
  },
  {
    label: "Люди и животные",
    emojis: [
      emoji("👨‍👩‍👧‍👦", "family", "people", "семья", "люди"),
      emoji("👶", "baby", "child", "ребёнок", "дети"),
      emoji("👧", "girl", "child", "девочка", "дети"),
      emoji("👦", "boy", "child", "мальчик", "дети"),
      emoji("👵", "grandmother", "family", "бабушка", "семья"),
      emoji("👴", "grandfather", "family", "дедушка", "семья"),
      emoji("🧑", "person", "people", "человек", "люди"),
      emoji("👋", "hello", "people", "привет", "люди"),
      emoji("🐶", "dog", "pet", "собака", "питомец"),
      emoji("🐱", "cat", "pet", "кошка", "питомец"),
      emoji("🐭", "mouse", "pet", "мышь", "питомец"),
      emoji("🐹", "hamster", "pet", "хомяк", "питомец"),
      emoji("🐰", "rabbit", "pet", "кролик", "питомец"),
      emoji("🦜", "bird", "pet", "птица", "питомец"),
      emoji("🐟", "fish", "pet", "рыба", "питомец"),
      emoji("🐢", "turtle", "pet", "черепаха", "питомец"),
      emoji("🐾", "animals", "pets", "животные", "питомцы"),
    ],
  },
  {
    label: "Путешествия",
    emojis: [
      emoji("🌍", "world", "travel", "мир", "путешествия"),
      emoji("🌎", "world", "travel", "мир", "путешествия"),
      emoji("🗺️", "map", "travel", "карта", "путешествия"),
      emoji("🧳", "luggage", "travel", "багаж", "путешествия"),
      emoji("🏨", "hotel", "travel", "отель", "путешествия"),
      emoji("🛎️", "hotel", "service", "отель", "сервис"),
      emoji("📍", "location", "place", "место", "локация"),
      emoji("🗽", "landmark", "usa", "достопримечательность", "америка"),
      emoji("🗼", "landmark", "paris", "достопримечательность", "париж"),
      emoji("🏰", "castle", "history", "замок", "история"),
      emoji("⛱️", "vacation", "beach", "отпуск", "пляж"),
      emoji("🌴", "tropical", "vacation", "тропики", "отпуск"),
      emoji("🏕️", "camping", "nature", "кемпинг", "природа"),
      emoji("⛰️", "mountains", "hiking", "горы", "поход"),
      emoji("🏞️", "nature", "park", "природа", "парк"),
    ],
  },
];

export const CATEGORY_EMOJIS = [
  ...new Set(CATEGORY_EMOJI_GROUPS.flatMap((group) => group.emojis.map((item) => item.emoji))),
];
