/**
 * The player's persistent record: who they are, everyone they have met, and
 * how each of those is going.
 *
 * Kept separate from the template's settings save so the two schemas can move
 * independently. Writes are debounced because a date banks affection, gifts and
 * coins in the same frame.
 */
import { getRunCapabilities, readAppStorage, writeAppStorage } from "../sdk/runSdk.ts";

/**
 * The character the player is. Any cast member can be picked, so this is an id
 * rather than a gender flag. Saves written before the picker opened up store
 * "f"/"m" and are migrated on load.
 */
export type Avatar = string;

const LEGACY_AVATAR: Record<string, string> = {
    f: "char_f_artist",
    m: "char_m_athlete",
};

export interface MetPerson {
    id: string;
    /** 0..100. Gates which actions are even offered. */
    affection: number;
    dates: number;
    /** Topics the player has seen them light up about. */
    learned: string[];
    bestSpark: number;
    /** Set when this person has been asked out. Only one at a time. */
    partner: boolean;
}

export interface Profile {
    version: 2;
    avatar: Avatar | null;
    coins: number;
    /** Offer ids already bought, for one-time and gated offers. */
    purchases: string[];
    /** Permanent unlocks granted by a purchase. */
    entitlements: string[];
    /** Day-of-year the free-gift ad was last claimed, -1 for never. */
    freeGiftClaimedOn: number;
    /** Dates finished, used to space the between-dates interstitial. */
    datesSinceAd: number;
    people: Record<string, MetPerson>;
    /** Gift id -> how many are in the bag. */
    inventory: Record<string, number>;
    /** Set once the How to play legend has been shown; Settings can re-open it. */
    tutorialSeen: boolean;
    /** First-date teach-by-doing progress: 0..3. */
    tutorialStep: number;
    /** Durable once-ever analytics marks. Browser storage is unavailable in RUN. */
    analyticsMarks: string[];
    /** Prevents the contextual Like prompt from nagging after the player acts. */
    likePromptSeen: boolean;
    /** Last trusted local day on which the return bonus was claimed. */
    lastReturnRewardDay: string | null;
    /** Forgiving consecutive-day return count. Missing a day restarts at one. */
    returnStreak: number;
    totalDates: number;
}

// RUN appStorage rejects keys containing "." — a dotted key fails every write.
const KEY = "koi-no-yokan-profile";

const EMPTY: Profile = {
    version: 2,
    avatar: null,
    coins: 120,
    purchases: [],
    entitlements: [],
    freeGiftClaimedOn: -1,
    datesSinceAd: 0,
    people: {},
    inventory: { bubbletea: 1 },
    tutorialSeen: false,
    tutorialStep: 0,
    analyticsMarks: [],
    likePromptSeen: false,
    lastReturnRewardDay: null,
    returnStreak: 0,
    totalDates: 0,
};

let profile: Profile = structuredClone(EMPTY);
const listeners = new Set<() => void>();
let writeTimer: number | null = null;
let lastPersisted = "";
let pendingPersist: string | null = null;
let persistInFlight: Promise<boolean> | null = null;

function notify(): void {
    for (const listener of listeners) listener();
}

function schedulePersist(): void {
    pendingPersist = JSON.stringify(profile);
    if (writeTimer !== null || persistInFlight) return;
    writeTimer = window.setTimeout(() => {
        writeTimer = null;
        void flushProfile();
    }, 400);
}

async function persist(serialized: string): Promise<boolean> {
    const capabilities = getRunCapabilities();
    if (capabilities.host && !capabilities.mock) return writeAppStorage(KEY, serialized);
    try {
        localStorage.setItem(KEY, serialized);
        return true;
    } catch (error) {
        console.warn("[profile] local fallback write failed", error);
        return false;
    }
}

/** Flush immediately on lifecycle and outcome boundaries. */
export async function flushProfile(): Promise<boolean> {
    if (writeTimer !== null) {
        window.clearTimeout(writeTimer);
        writeTimer = null;
    }
    pendingPersist = JSON.stringify(profile);
    if (persistInFlight) return persistInFlight;
    persistInFlight = (async () => {
        let ok = true;
        while (pendingPersist !== null) {
            const next = pendingPersist;
            pendingPersist = null;
            if (next === lastPersisted) continue;
            const saved = await persist(next);
            if (saved) lastPersisted = next;
            else ok = false;
        }
        return ok;
    })().finally(() => {
        persistInFlight = null;
    });
    return persistInFlight;
}

function coerce(raw: unknown): Profile {
    if (!raw || typeof raw !== "object") return structuredClone(EMPTY);
    const value = raw as Partial<Profile>;
    const people: Record<string, MetPerson> = {};
    for (const [id, person] of Object.entries(value.people ?? {})) {
        if (!person || typeof person !== "object") continue;
        const p = person as Partial<MetPerson>;
        people[id] = {
            id,
            affection: Math.max(0, Math.min(100, Number(p.affection) || 0)),
            dates: Math.max(0, Number(p.dates) || 0),
            learned: Array.isArray(p.learned) ? p.learned.filter((t): t is string => typeof t === "string") : [],
            bestSpark: Math.max(0, Number(p.bestSpark) || 0),
            partner: p.partner === true,
        };
    }
    const inventory: Record<string, number> = {};
    for (const [id, count] of Object.entries(value.inventory ?? {})) {
        const n = Math.max(0, Math.floor(Number(count) || 0));
        if (n > 0) inventory[id] = n;
    }
    const avatar = typeof value.avatar === "string" ? (LEGACY_AVATAR[value.avatar] ?? value.avatar) : null;
    const totalDates = Math.max(0, Number(value.totalDates) || 0);
    const inferredAnalyticsMarks: string[] = [];
    // v1 saves predate host-backed funnel marks. Infer only beats guaranteed
    // by durable state so existing players do not re-enter the FTUE funnel.
    if (avatar) {
        inferredAnalyticsMarks.push("koi_first_play:1:game_loaded", "koi_first_play:2:avatar_chosen");
    }
    if (totalDates >= 1) {
        inferredAnalyticsMarks.push(
            "koi_first_play:3:first_date_planned",
            "koi_first_play:4:first_date_started",
            "koi_first_play:5:first_date_finished",
            "koi_first_play:6:first_result_viewed",
        );
    }
    if (totalDates >= 2) inferredAnalyticsMarks.push("koi_first_play:7:second_date_planned");
    return {
        version: 2,
        avatar,
        coins: Math.max(0, Number(value.coins) || 0),
        purchases: Array.isArray(value.purchases)
            ? value.purchases.filter((x): x is string => typeof x === "string")
            : [],
        entitlements: Array.isArray(value.entitlements)
            ? value.entitlements.filter((x): x is string => typeof x === "string")
            : [],
        freeGiftClaimedOn: Number.isFinite(Number(value.freeGiftClaimedOn)) ? Number(value.freeGiftClaimedOn) : -1,
        datesSinceAd: Math.max(0, Number(value.datesSinceAd) || 0),
        people,
        inventory,
        tutorialSeen: value.tutorialSeen === true,
        tutorialStep:
            value.tutorialSeen === true ? 3 : Math.max(0, Math.min(3, Math.floor(Number(value.tutorialStep) || 0))),
        analyticsMarks: Array.isArray(value.analyticsMarks)
            ? [...new Set(value.analyticsMarks.filter((mark): mark is string => typeof mark === "string"))]
            : inferredAnalyticsMarks,
        likePromptSeen: value.likePromptSeen === true,
        lastReturnRewardDay: typeof value.lastReturnRewardDay === "string" ? value.lastReturnRewardDay : null,
        returnStreak: Math.max(0, Math.floor(Number(value.returnStreak) || 0)),
        totalDates,
    };
}

export async function loadProfile(): Promise<Profile> {
    try {
        const capabilities = getRunCapabilities();
        if (capabilities.host && !capabilities.mock) {
            const stored = await readAppStorage(KEY);
            if (stored.ok && stored.value) profile = coerce(JSON.parse(stored.value));
        } else {
            const stored = localStorage.getItem(KEY);
            if (stored) profile = coerce(JSON.parse(stored));
        }
    } catch (error) {
        console.warn("[profile] load failed, starting fresh", error);
        profile = structuredClone(EMPTY);
    }
    lastPersisted = JSON.stringify(profile);
    notify();
    return profile;
}

export function getProfile(): Profile {
    return profile;
}

export function subscribeProfile(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function mutate(fn: (draft: Profile) => void): void {
    const next = structuredClone(profile);
    fn(next);
    profile = next;
    notify();
    schedulePersist();
}

export function setAvatar(avatar: Avatar): void {
    mutate((p) => {
        p.avatar = avatar;
        // You cannot be your own partner. Since the choice can now be changed
        // after the fact, becoming the person you are seeing has to end that
        // relationship — otherwise the hub shows the same face in both slots
        // and the plan screen, which filters you out of its own candidates,
        // offers nobody to see them about.
        const person = p.people[avatar];
        if (person?.partner) person.partner = false;
    });
}

export function personFor(id: string): MetPerson {
    return profile.people[id] ?? { id, affection: 0, dates: 0, learned: [], bestSpark: 0, partner: false };
}

/** Bank the result of a date. Returns the person's new record. */
export function recordDate(id: string, gained: number, spark: number, learned: string[]): MetPerson {
    mutate((p) => {
        const existing = p.people[id] ?? { id, affection: 0, dates: 0, learned: [], bestSpark: 0, partner: false };
        const merged = new Set([...existing.learned, ...learned]);
        p.people[id] = {
            ...existing,
            affection: Math.max(0, Math.min(100, existing.affection + gained)),
            dates: existing.dates + 1,
            learned: [...merged],
            bestSpark: Math.max(existing.bestSpark, Math.round(spark)),
        };
        p.totalDates += 1;
        // Dates pay for themselves; the shop is the sink.
        p.coins += 20 + Math.round(spark / 6);
    });
    return personFor(id);
}

/**
 * Ask someone out. Exactly one partner at a time — and everyone else you have
 * been seeing takes it badly.
 */
export function setPartner(id: string): { jealous: string[] } {
    const jealous: string[] = [];
    mutate((p) => {
        for (const person of Object.values(p.people)) {
            if (person.id === id) {
                person.partner = true;
                continue;
            }
            if (person.partner) person.partner = false;
            // Anyone you had gotten close to loses ground.
            if (person.affection >= 35) {
                person.affection = Math.max(0, person.affection - 12);
                jealous.push(person.id);
            }
        }
    });
    return { jealous };
}

/** Grant what an offer contains, once the host has verified the purchase. */
export function grantOffer(offerId: string, hearts: number, gifts: string[], entitlement?: string): void {
    mutate((p) => {
        if (!p.purchases.includes(offerId)) p.purchases.push(offerId);
        p.coins += hearts;
        for (const gift of gifts) p.inventory[gift] = (p.inventory[gift] ?? 0) + 1;
        if (entitlement && !p.entitlements.includes(entitlement)) p.entitlements.push(entitlement);
    });
}

/** Add affection on top of what a date already banked (rewarded-ad payout). */
export function bankExtraAffection(id: string, amount: number): void {
    mutate((p) => {
        const person = p.people[id];
        if (!person) return;
        person.affection = Math.max(0, Math.min(100, person.affection + amount));
    });
}

export function grantHearts(hearts: number): void {
    mutate((p) => {
        p.coins += hearts;
    });
}

export function grantGift(giftId: string): void {
    mutate((p) => {
        p.inventory[giftId] = (p.inventory[giftId] ?? 0) + 1;
    });
}

/** The How to play legend has been seen (it can always be re-opened). */
export function markTutorialSeen(): void {
    mutate((p) => {
        p.tutorialSeen = true;
        p.tutorialStep = 3;
    });
}

/** Advance the first-date coach without ever moving it backwards. */
export function advanceTutorialStep(step: number): number {
    const next = Math.max(0, Math.min(3, Math.floor(step)));
    mutate((p) => {
        p.tutorialStep = Math.max(p.tutorialStep, next);
        p.tutorialSeen = p.tutorialStep >= 3;
    });
    return profile.tutorialStep;
}

export function hasAnalyticsMark(mark: string): boolean {
    return profile.analyticsMarks.includes(mark);
}

export function addAnalyticsMark(mark: string): void {
    if (hasAnalyticsMark(mark)) return;
    mutate((p) => {
        p.analyticsMarks.push(mark);
    });
}

export function removeAnalyticsMark(mark: string): void {
    if (!hasAnalyticsMark(mark)) return;
    mutate((p) => {
        p.analyticsMarks = p.analyticsMarks.filter((entry) => entry !== mark);
    });
}

export function markLikePromptSeen(): void {
    if (profile.likePromptSeen) return;
    mutate((p) => {
        p.likePromptSeen = true;
    });
}

function dayOrdinal(dayKey: string): number | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export const RETURN_REWARD_HEARTS = 25;

export interface ReturnRewardStatus {
    claimable: boolean;
    nextStreak: number;
    amount: number;
}

export function returnRewardStatus(dayKey: string): ReturnRewardStatus {
    // The first finished date arms the loop; it is not itself a "return".
    // Without this guard a new player saw a welcome-back reward immediately
    // after their first evening, teaching the opposite of the intended habit.
    if (profile.totalDates < 1 || !profile.lastReturnRewardDay || profile.lastReturnRewardDay === dayKey) {
        return { claimable: false, nextStreak: profile.returnStreak, amount: RETURN_REWARD_HEARTS };
    }
    const todayOrdinal = dayOrdinal(dayKey);
    const priorOrdinal = profile.lastReturnRewardDay ? dayOrdinal(profile.lastReturnRewardDay) : null;
    const nextStreak =
        todayOrdinal !== null && priorOrdinal !== null && todayOrdinal - priorOrdinal === 1
            ? profile.returnStreak + 1
            : 1;
    return { claimable: true, nextStreak, amount: RETURN_REWARD_HEARTS };
}

/** Start the return loop without granting anything on the same day. */
export function armReturnReward(dayKey: string): void {
    if (profile.lastReturnRewardDay) return;
    mutate((p) => {
        p.lastReturnRewardDay = dayKey;
    });
}

/** Grant the soft-currency return bonus once for a trusted day key. */
export function claimReturnReward(dayKey: string): ReturnRewardStatus {
    const status = returnRewardStatus(dayKey);
    if (!status.claimable) return status;
    mutate((p) => {
        p.lastReturnRewardDay = dayKey;
        p.returnStreak = status.nextStreak;
        p.coins += status.amount;
    });
    return { ...status, claimable: false };
}

export function hasEntitlement(id: string): boolean {
    return profile.entitlements.includes(id);
}

export function hasPurchased(offerId: string): boolean {
    return profile.purchases.includes(offerId);
}

/** Day number, so the free-gift ad resets once a day rather than per session. */
export function today(): number {
    return Math.floor(Date.now() / 86_400_000);
}

export function claimFreeGiftDay(): void {
    mutate((p) => {
        p.freeGiftClaimedOn = today();
    });
}

/**
 * Count a finished date and say whether this is an interstitial beat. Counted
 * here rather than in the UI so a reload cannot reset the spacing.
 */
export function noteDateFinished(every: number): boolean {
    const due = profile.datesSinceAd + 1 >= every;
    mutate((p) => {
        p.datesSinceAd = due ? 0 : p.datesSinceAd + 1;
    });
    return due;
}

export function breakUp(id: string): void {
    mutate((p) => {
        const person = p.people[id];
        if (person) person.partner = false;
    });
}

export function currentPartner(): MetPerson | null {
    return Object.values(profile.people).find((p) => p.partner) ?? null;
}

/** Total affection across everyone — what unlocks new locations. */
export function totalAffection(): number {
    return Object.values(profile.people).reduce((sum, p) => sum + p.affection, 0);
}

/**
 * A deterministic monotonic leaderboard score.
 *
 * One completed date is worth 1,000 points and total affection breaks ties.
 * Affection can fall by at most 800 across the whole cast, so the next date's
 * 1,000-point step always exceeds any relationship loss.
 */
export function romanceScore(): number {
    return profile.totalDates * 1_000 + totalAffection();
}

export function buyGift(giftId: string, price: number): boolean {
    if (profile.coins < price) return false;
    mutate((p) => {
        p.coins -= price;
        p.inventory[giftId] = (p.inventory[giftId] ?? 0) + 1;
    });
    return true;
}

/**
 * Spend hearts on a postcard. Returns false (and charges nothing) when the
 * player cannot afford it, so the caller never has to pre-check and then race
 * against its own check.
 */
export function spendHearts(price: number): boolean {
    if (profile.coins < price) return false;
    mutate((p) => {
        p.coins -= price;
    });
    return true;
}

export function consumeGift(giftId: string): boolean {
    if ((profile.inventory[giftId] ?? 0) <= 0) return false;
    mutate((p) => {
        const left = (p.inventory[giftId] ?? 0) - 1;
        if (left > 0) p.inventory[giftId] = left;
        else delete p.inventory[giftId];
    });
    return true;
}

export function giftCount(giftId: string): number {
    return profile.inventory[giftId] ?? 0;
}

export function hasAnyGift(): boolean {
    return Object.values(profile.inventory).some((n) => n > 0);
}
