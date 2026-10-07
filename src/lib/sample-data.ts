import type { LoveCoin, LoveNote, ReactionType } from "./types";

const dayAgo = (d: number, h = 9) => {
  const now = new Date();
  now.setDate(now.getDate() - d);
  now.setHours(h, 24, 0, 0);
  return now.toISOString();
};

export const SAMPLE_COINS: LoveCoin[] = [
  {
    id: "coin-18472",
    coin_number: 18472,
    owner_id: "user-simi",
    creator_name: "Simi",
    recipient_name: "Abbie",
    relation: "Someone I love",
    message:
      "I created this LoveCoin for my wife because ordinary days with her never feel ordinary.",
    style: "romantic",
    visibility: "public",
    status: "claimed",
    created_at: dayAgo(1, 20),
    image_url: null,
  },
  {
    id: "coin-18211",
    coin_number: 18211,
    owner_id: "user-tolu",
    creator_name: "Tolu",
    recipient_name: "Dad",
    relation: "Family",
    message:
      "I called my dad today just because I hadn't heard his voice in a while. He talked for an hour.",
    style: "classic",
    visibility: "public",
    status: "claimed",
    created_at: dayAgo(4, 11),
    image_url: null,
  },
  {
    id: "coin-18033",
    coin_number: 18033,
    owner_id: "user-nadia",
    creator_name: "Nadia",
    recipient_name: "Ife",
    relation: "Friend",
    message:
      "My best friend remembered my interview was today and texted me right before I walked in.",
    style: "minimal",
    visibility: "public",
    status: "claimed",
    created_at: dayAgo(7, 8),
    image_url: null,
  },
  {
    id: "coin-18590",
    coin_number: 18590,
    owner_id: "user-kemi",
    creator_name: "Kemi",
    recipient_name: "Zuri",
    relation: "Family",
    message: "My daughter left me a note in my bag this morning. I kept it. Now I'm keeping this.",
    style: "golden",
    visibility: "public",
    status: "claimed",
    created_at: dayAgo(12, 17),
    image_url: null,
  },
  {
    id: "coin-18310",
    coin_number: 18310,
    owner_id: "user-david",
    creator_name: "David",
    recipient_name: "Grandma Rose",
    relation: "Someone special",
    message: "For the woman who taught me that love is mostly just showing up. Every single time.",
    style: "personal",
    visibility: "public",
    status: "claimed",
    created_at: dayAgo(20, 15),
    image_url: null,
  },
];

export const SAMPLE_NOTES: LoveNote[] = [
  {
    id: "note-1",
    user_id: "user-amaka",
    author_name: "Amaka",
    content:
      "My mum called me this morning just to make sure I had eaten. Sometimes the smallest things mean the most.",
    love_type: "received",
    category: "Family",
    created_at: dayAgo(0, 8),
    love_coin_id: null,
  },
  {
    id: "note-2",
    user_id: "user-tobi",
    author_name: "Tobi",
    content:
      "Someone paid for my coffee today. I don't know their name, but they made my morning lighter than it had any right to be.",
    love_type: "received",
    category: "Kindness",
    created_at: dayAgo(0, 11),
    love_coin_id: null,
  },
  {
    id: "note-3",
    user_id: "user-simi",
    author_name: "Simi",
    content:
      "I made a LoveCoin for my wife tonight. Ordinary Tuesday. Ordinary jollof. Nothing ordinary about her.",
    love_type: "gave",
    category: "Romantic",
    created_at: dayAgo(0, 21),
    love_coin_id: "coin-18472",
  },
  {
    id: "note-4",
    user_id: "user-nadia",
    author_name: "Nadia",
    content:
      "My best friend remembered my interview was today and texted me before I walked in. I read it twice in the elevator.",
    love_type: "received",
    category: "Friendship",
    created_at: dayAgo(1, 9),
    love_coin_id: "coin-18033",
  },
  {
    id: "note-5",
    user_id: "user-kemi",
    author_name: "Kemi",
    content: "My daughter left me a note in my bag this morning. Six words. I cried at my desk.",
    love_type: "received",
    category: "Family",
    created_at: dayAgo(1, 14),
    love_coin_id: "coin-18590",
  },
  {
    id: "note-6",
    user_id: "user-tolu",
    author_name: "Tolu",
    content:
      "I called my dad today just because I hadn't heard his voice in a while. We talked about nothing for an hour.",
    love_type: "gave",
    category: "Family",
    created_at: dayAgo(2, 19),
    love_coin_id: "coin-18211",
  },
  {
    id: "note-7",
    user_id: "user-ife",
    author_name: "Ifeoma",
    content:
      "My old boss still checks in on me two jobs later. She has no reason to. That's the whole point.",
    love_type: "received",
    category: "Mentorship",
    created_at: dayAgo(3, 10),
    love_coin_id: null,
  },
  {
    id: "note-8",
    user_id: "user-david",
    author_name: "David",
    content:
      "Cooked too much rice on purpose so I could take a plate to the security man downstairs. He called me 'my son'.",
    love_type: "gave",
    category: "Community",
    created_at: dayAgo(4, 18),
    love_coin_id: null,
  },
  {
    id: "note-9",
    user_id: "user-zainab",
    author_name: "Zainab",
    content:
      "It's been three years since my grandmother passed. I made her stew today, exactly the way she did. The kitchen smelled like her.",
    love_type: "gave",
    category: "Remembrance",
    created_at: dayAgo(5, 13),
    love_coin_id: null,
  },
];

export const SAMPLE_REACTIONS: Record<string, Partial<Record<ReactionType, number>>> = {
  "note-1": { loved: 128, felt: 42, smile: 19, beautiful: 31 },
  "note-2": { loved: 74, grateful: 26, beautiful: 12 },
  "note-3": { loved: 96, inspired: 33, smile: 28 },
  "note-4": { loved: 61, felt: 40, smile: 22 },
  "note-5": { loved: 143, smile: 58, felt: 24 },
  "note-6": { loved: 88, felt: 31, grateful: 17 },
  "note-7": { loved: 52, inspired: 29, grateful: 14 },
  "note-8": { loved: 67, beautiful: 21, grateful: 35 },
  "note-9": { loved: 112, felt: 63, beautiful: 44 },
};

/**
 * A deterministic slice of the wider community so the heart never looks empty.
 * These behave exactly like any other claimed LoveCoin.
 */
const CREATORS = ["Ada", "Bayo", "Chidi", "Dami", "Emeka", "Farida", "Gbemi", "Hauwa", "Ibrahim", "Joy", "Kola", "Lara", "Muna", "Ngozi", "Obi", "Peju", "Rita", "Segun", "Tara", "Uche", "Yemi", "Zara"];
const RECIPIENTS = ["Mum", "Dad", "my wife", "my husband", "Ada", "my brother", "Grandma", "my daughter", "my son", "Tunde", "Bisi", "my best friend", "Nneka", "Sade", "Kunle"];
const MESSAGES = [
  "For the woman who calls just to hear me breathe.",
  "You made an ordinary year feel like a good one.",
  "Thank you for the quiet ways you show up.",
  "Kept here so I never forget how today felt.",
  "Twelve years, and you still make me laugh first thing in the morning.",
  "For the friend who answers at 2am without asking why.",
  "Because you believed it before I did.",
  "A small place for a big thank you.",
];
const STYLES = ["classic", "romantic", "minimal", "golden", "personal"] as const;

function seeded(n: number) {
  const s = Math.sin(n * 91.37 + 17.13) * 9137.77;
  return s - Math.floor(s);
}

export const COMMUNITY_COINS: LoveCoin[] = Array.from({ length: 150 }, (_, i): LoveCoin => {
  const r = seeded(i + 3);
  const number = 18000 + Math.floor(seeded(i + 11) * 900);
  return {
    id: `coin-community-${i}`,
    coin_number: number,
    owner_id: `user-community-${i}`,
    creator_name: CREATORS[Math.floor(r * CREATORS.length)] as string,
    recipient_name: RECIPIENTS[Math.floor(seeded(i + 29) * RECIPIENTS.length)] as string,
    relation: "Someone I love",
    message: MESSAGES[Math.floor(seeded(i + 47) * MESSAGES.length)] as string,
    style: STYLES[Math.floor(seeded(i + 61) * STYLES.length)] as LoveCoin["style"],
    visibility: "public",
    status: "claimed",
    created_at: dayAgo(5 + (i % 90), 12),
    image_url: null,
  };
}).filter(
  (c, i, arr) =>
    !SAMPLE_COINS.some((s) => s.coin_number === c.coin_number) &&
    arr.findIndex((x) => x.coin_number === c.coin_number) === i,
);
