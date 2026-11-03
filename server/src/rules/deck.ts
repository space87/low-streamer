import type { Card, Phase, Seat } from "../../../shared/src/types.ts";
import { RulesError } from "./scoring.ts";

/** Returns a float in [0, 1). Inject crypto-backed RNG in production, seeded RNG in tests. */
export type Rng = () => number;

export interface HandCard { cardId: string; drawnRound: number }

export interface DeckState {
  deck: string[];          // top of deck = index 0; never sent to clients
  hand: HandCard[];
  discard: string[];
  achieved: string[];
  usedPaidRedraw: boolean;
  cp: number;
  lastCpDiscardTurn?: string; // `${round}-${seat}` guard: one CP-discard action per own turn
}

export type DrawPrompt =
  | { type: "may-redraw"; cardId: string; reason: string; shuffleBack: boolean }
  | { type: "note"; cardId: string; prompt: string };

export interface DeckCtx {
  round: number;
  phase: Phase;
  activeSeat: Seat;
  seat: Seat;
}

export function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createDeck(cards: Card[], rng: Rng, startingCp = 0): DeckState {
  return {
    deck: shuffle(cards.map((c) => c.id), rng),
    hand: [], discard: [], achieved: [], usedPaidRedraw: false, cp: startingCp,
  };
}

function insertRandom(deck: string[], cardId: string, rng: Rng): string[] {
  const d = [...deck];
  d.splice(Math.floor(rng() * (d.length + 1)), 0, cardId);
  return d;
}

const MAX_AUTO_REDRAWS = 20;

/** Draw n cards, applying when-drawn rules. Must-redraw rules resolve automatically. */
export function draw(
  state: DeckState, n: number, cards: Map<string, Card>, round: number, rng: Rng,
): { state: DeckState; drawn: string[]; prompts: DrawPrompt[]; deckEmpty: boolean } {
  let s: DeckState = { ...state, deck: [...state.deck], hand: [...state.hand] };
  const drawn: string[] = [];
  const prompts: DrawPrompt[] = [];
  let need = n;
  let guard = 0;

  while (need > 0 && s.deck.length > 0) {
    if (guard++ > MAX_AUTO_REDRAWS + n) break;
    const cardId = s.deck[0];
    s.deck = s.deck.slice(1);
    const card = cards.get(cardId);
    if (!card) throw new RulesError("unknown-card", `Unknown card ${cardId}`);

    const must = card.whenDrawn?.find((r) => r.type === "must-redraw-if-round" && r.round === round);
    // Only shuffle back if another card could still be drawn; otherwise keep it.
    if (must && s.deck.length > 0) {
      s.deck = insertRandom(s.deck, cardId, rng);
      // Avoid immediately redrawing the same card: if it landed on top, move it down one.
      if (s.deck[0] === cardId && s.deck.length > 1) s.deck = [s.deck[1], cardId, ...s.deck.slice(2)];
      continue;
    }

    s.hand.push({ cardId, drawnRound: round });
    drawn.push(cardId);
    need--;

    for (const rule of card.whenDrawn ?? []) {
      if (rule.type === "may-redraw-if-round" && rule.round === round) {
        prompts.push({ type: "may-redraw", cardId, reason: `Drawn in battle round ${round}`, shuffleBack: true });
      } else if (rule.type === "may-redraw-if-condition") {
        prompts.push({ type: "may-redraw", cardId, reason: rule.prompt, shuffleBack: rule.shuffleBack });
      } else if (rule.type === "may-redraw-if-active" && s.hand.some((h) => h.cardId === rule.otherCardId)) {
        prompts.push({ type: "may-redraw", cardId, reason: `${cards.get(rule.otherCardId)?.name ?? rule.otherCardId} is active`, shuffleBack: true });
      } else if (rule.type === "note") {
        prompts.push({ type: "note", cardId, prompt: rule.prompt });
      }
    }
  }
  return { state: s, drawn, prompts, deckEmpty: s.deck.length === 0 };
}

function requireInHand(state: DeckState, cardId: string): void {
  if (!state.hand.some((h) => h.cardId === cardId)) throw new RulesError("not-in-hand", "That card is not in your hand");
}

function removeFromHand(state: DeckState, cardId: string): HandCard[] {
  const i = state.hand.findIndex((h) => h.cardId === cardId);
  return [...state.hand.slice(0, i), ...state.hand.slice(i + 1)];
}

/** Accept a "may redraw" prompt: the card goes back into the deck (or discard) and one new card is drawn. */
export function resolveRedraw(
  state: DeckState, cardId: string, shuffleBack: boolean, cards: Map<string, Card>, round: number, rng: Rng,
) {
  requireInHand(state, cardId);
  const hand = removeFromHand(state, cardId);
  const next: DeckState = shuffleBack
    ? { ...state, hand, deck: insertRandom(state.deck, cardId, rng) }
    : { ...state, hand, discard: [...state.discard, cardId] };
  return draw(next, 1, cards, round, rng);
}

/** Tactical: scoring a card achieves it (it leaves the hand). */
export function achieve(state: DeckState, cardId: string): DeckState {
  requireInHand(state, cardId);
  return { ...state, hand: removeFromHand(state, cardId), achieved: [...state.achieved, cardId] };
}

/** End of your own turn: discard one or more active cards to gain 1 CP. */
export function discardForCp(state: DeckState, cardIds: string[], ctx: DeckCtx): DeckState {
  if (ctx.activeSeat !== ctx.seat || ctx.phase !== "turn-end") {
    throw new RulesError("timing", "You can only discard for CP at the end of your own turn");
  }
  if (cardIds.length === 0) throw new RulesError("empty", "Choose at least one card");
  const turnKey = `${ctx.round}-${ctx.seat}`;
  if (state.lastCpDiscardTurn === turnKey) throw new RulesError("once", "Already discarded for CP this turn");
  let s = state;
  for (const id of new Set(cardIds)) {
    requireInHand(s, id);
    s = { ...s, hand: removeFromHand(s, id), discard: [...s.discard, id] };
  }
  return { ...s, cp: s.cp + 1, lastCpDiscardTurn: turnKey };
}

/** Once per battle, at the end of your Command phase: pay 1 CP, discard one card, draw one. */
export function paidRedraw(state: DeckState, cardId: string, ctx: DeckCtx, cards: Map<string, Card>, rng: Rng) {
  if (state.usedPaidRedraw) throw new RulesError("once", "The paid redraw has already been used this battle");
  if (ctx.activeSeat !== ctx.seat || ctx.phase !== "command") {
    throw new RulesError("timing", "Use this at the end of your Command phase");
  }
  if (state.cp < 1) throw new RulesError("cp", "Not enough CP");
  requireInHand(state, cardId);
  const next: DeckState = {
    ...state, cp: state.cp - 1, usedPaidRedraw: true,
    hand: removeFromHand(state, cardId), discard: [...state.discard, cardId],
  };
  return draw(next, 1, cards, ctx.round, rng);
}

/** Manual mode: the player tells us which physical card they drew. */
export function manualAdd(state: DeckState, cardId: string, round: number): DeckState {
  const inPlay = [...state.hand.map((h) => h.cardId), ...state.discard, ...state.achieved];
  if (inPlay.includes(cardId)) throw new RulesError("duplicate", "That card has already been drawn");
  return { ...state, deck: state.deck.filter((d) => d !== cardId), hand: [...state.hand, { cardId, drawnRound: round }] };
}

/** Public view for opponents/overlays: never includes deck order. */
export function publicDeckView(state: DeckState) {
  return {
    hand: state.hand, discard: state.discard, achieved: state.achieved,
    deckCount: state.deck.length, usedPaidRedraw: state.usedPaidRedraw, cp: state.cp,
  };
}

/** Deterministic RNG for tests (mulberry32). */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Crypto-backed RNG for production shuffles. */
export function cryptoRng(): Rng {
  const buf = new Uint32Array(1);
  return () => {
    globalThis.crypto.getRandomValues(buf);
    return buf[0] / 4294967296;
  };
}
