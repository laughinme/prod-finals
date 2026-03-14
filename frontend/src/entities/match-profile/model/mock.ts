import type {
  CurrentUserPreview,
  MatchChatMessage,
  MatchProfile,
  MatchProfileId,
  MatchmakingDraft,
} from "./types";

export const MATCHMAKING_INTERESTS = [
  "Кофе",
  "Спорт",
  "Кино",
  "Игры",
  "Рестораны",
  "Выставки",
  "Путешествия",
  "Технологии",
  "Искусство",
  "Музыка",
] as const;

export const EMPTY_MATCHMAKING_DRAFT: MatchmakingDraft = {
  photoUploaded: false,
  name: "",
  age: "",
  interests: [],
};

export const CURRENT_USER_PREVIEW: CurrentUserPreview = {
  image:
    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=400&auto=format&fit=crop",
};

export const MOCK_DISCOVERY_PROFILES: MatchProfile[] = [
  {
    id: 1,
    candidateUserId: null,
    name: "Алиса",
    age: 26,
    image:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=800&auto=format&fit=crop",
    matchScore: 92,
    tags: ["Кофеман", "Кино", "Такси"],
    explanation:
      "Вы оба часто завтракаете в кофейнях в центре и предпочитаете активный отдых по выходным. А еще у вас совпадают вкусы на кинопремьеры.",
    location: "Москва, Центр",
    activity: "Активна сегодня",
    reasonCodes: ["lifestyle_overlap", "behavioral_signal", "city_fit"],
    detailsAvailable: true,
    actions: {
      canLike: true,
      canPass: true,
      canHide: true,
      canBlock: true,
      canReport: true,
    },
    source: "mock",
  },
  {
    id: 2,
    candidateUserId: null,
    name: "Максим",
    age: 28,
    image:
      "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=800&auto=format&fit=crop",
    matchScore: 85,
    tags: ["Спорт", "Доставка", "Игры"],
    explanation:
      "Ваши ритмы жизни похожи: тренировки по вечерам в будни и заказы из ресторанов по пятницам.",
    location: "Москва, Юг",
    activity: "Был(а) вчера",
    reasonCodes: ["behavioral_signal", "goal_fit", "profile_quality"],
    detailsAvailable: true,
    actions: {
      canLike: true,
      canPass: true,
      canHide: true,
      canBlock: true,
      canReport: true,
    },
    source: "mock",
  },
];

export const INITIAL_CHAT_MESSAGES: Partial<Record<MatchProfileId, MatchChatMessage[]>> = {
  1: [
    {
      id: 1,
      text: "Привет! Классное совпадение по кофе 😊",
      sender: "them",
      time: "14:30",
    },
  ],
};
