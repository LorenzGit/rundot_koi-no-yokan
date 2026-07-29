/**
 * Human-readable RUN SDK surface map for template diagnostics and docs.
 *
 * This is intentionally metadata, not an eager feature loader: importing the
 * template must never trigger purchases, generation spend, permissions, admin
 * actions, server writes, or a Playground login.
 */
export type CapabilitySafety =
    | "read-only"
    | "configured-write"
    | "player-gesture"
    | "paid-or-billed"
    | "privileged"
    | "server-only";

export interface CapabilityDefinition {
    id: string;
    sdk: string;
    summary: string;
    safety: CapabilitySafety;
    source: string;
    requires?: string;
}

export const RUN_CAPABILITIES = [
    {
        id: "host",
        sdk: "isAvailable / isMock / environment data",
        summary: "Host detection and capability negotiation.",
        safety: "read-only",
        source: "src/sdk/runSdk.ts",
    },
    {
        id: "access",
        sdk: "accessGate",
        summary: "Anonymous/member access tiers and explicit sign-in prompts.",
        safety: "player-gesture",
        source: "src/sdk/featureLab.ts",
    },
    {
        id: "lifecycle",
        sdk: "lifecycles",
        summary: "Pause, resume, sleep, awake, quit, back, and identity change.",
        safety: "read-only",
        source: "src/sdk/runSdk.ts",
    },
    {
        id: "app",
        sdk: "app",
        summary: "Role, release notes, launch intents, navigation, and creator admin APIs.",
        safety: "privileged",
        source: "src/sdk/featureLab.ts",
    },
    {
        id: "profile",
        sdk: "profile",
        summary: "Player profile and identity-aware presentation.",
        safety: "read-only",
        source: "src/sdk/featureLab.ts",
    },
    {
        id: "system",
        sdk: "system / device / environment",
        summary: "Device, platform, safe-area, locale, and environment facts.",
        safety: "read-only",
        source: "src/sdk/featureLab.ts",
    },
    {
        id: "feature-gates",
        sdk: "getFeatureFlag / getFeatureGate",
        summary: "Platform-provided feature flags and gates.",
        safety: "read-only",
        source: "src/sdk/featureLab.ts",
    },
    {
        id: "numbers",
        sdk: "numbers",
        summary: "Large-number normalization, formatting, and geometric economy helpers.",
        safety: "read-only",
        source: "src/sdk/featureLab.ts",
    },
    {
        id: "navigation",
        sdk: "navigation / requestPopOrQuit",
        summary: "Host-aware links, navigation, back, and exit handling.",
        safety: "player-gesture",
        source: "additional_features/client/navigation.ts",
    },
    {
        id: "popups",
        sdk: "popups",
        summary: "Platform-owned toast and dialog surfaces.",
        safety: "player-gesture",
        source: "src/sdk/featureLab.ts",
    },
    {
        id: "logging",
        sdk: "log / error",
        summary: "Structured diagnostics delivered to the host.",
        safety: "configured-write",
        source: "src/sdk/featureLab.ts",
    },
    {
        id: "storage",
        sdk: "appStorage / deviceCache / ownerStorage",
        summary: "Player, device, and owner-scoped key/value persistence.",
        safety: "configured-write",
        source: "src/systems/save.ts",
    },
    {
        id: "shared-storage",
        sdk: "sharedStorage / sharedAssets",
        summary: "Cross-app shared state and host-provided asset libraries.",
        safety: "configured-write",
        source: "additional_features/client/storage.ts",
    },
    {
        id: "files",
        sdk: "files",
        summary: "Durable uploads, metadata, visibility, quotas, and transforms.",
        safety: "configured-write",
        source: "additional_features/client/content.ts",
        requires: "RUN host and file policy",
    },
    {
        id: "cdn",
        sdk: "cdn",
        summary: "RUN CDN URL resolution and entitlement-aware asset fetches.",
        safety: "read-only",
        source: "src/sdk/featureLab.ts",
    },
    {
        id: "asset-loader",
        sdk: "loadAsset / preloadAssets / assetLoader",
        summary: "Host asset loading, progress, caching, and object-URL cleanup.",
        safety: "read-only",
        source: "additional_features/client/assets.ts",
    },
    {
        id: "preloader",
        sdk: "preloader",
        summary: "Native loading screen copy and progress.",
        safety: "configured-write",
        source: "src/sdk/featureLab.ts",
    },
    {
        id: "analytics",
        sdk: "analytics",
        summary: "Events, progression, spend, funnels, and attribution-safe telemetry.",
        safety: "configured-write",
        source: "src/systems/runtimeServices.ts",
    },
    {
        id: "attribution",
        sdk: "attribution",
        summary: "Launch/campaign attribution parameters.",
        safety: "read-only",
        source: "src/sdk/featureLab.ts",
    },
    {
        id: "liveops",
        sdk: "liveops",
        summary: "Remote config, assignments, overrides, and timed refresh.",
        safety: "read-only",
        source: "src/systems/runtimeServices.ts",
        requires: "uploaded LiveOps config",
    },
    {
        id: "time",
        sdk: "time",
        summary: "Trusted time plus platform locale-aware formatting.",
        safety: "read-only",
        source: "src/systems/serverTime.ts",
    },
    {
        id: "notifications",
        sdk: "notifications",
        summary: "Consent-aware local, inbox, and RCS messaging.",
        safety: "player-gesture",
        source: "src/sdk/runSdk.ts",
        requires: "consent and host support",
    },
    {
        id: "haptics",
        sdk: "triggerHapticAsync / system.getDevice().haptics",
        summary: "Preference-gated tactile feedback.",
        safety: "player-gesture",
        source: "src/systems/runtimeServices.ts",
    },
    {
        id: "gamepad",
        sdk: "gamepad",
        summary: "Controller discovery, connection events, and input snapshots.",
        safety: "read-only",
        source: "src/sdk/featureLab.ts",
    },
    {
        id: "audio-generation",
        sdk: "audioGen",
        summary: "Music, sound-effect, speech, and voice design generation.",
        safety: "paid-or-billed",
        source: "additional_features/client/generation.ts",
        requires: "explicit player action and credit budget",
    },
    {
        id: "ads",
        sdk: "ads",
        summary: "Interstitial and completion-verified rewarded ads.",
        safety: "player-gesture",
        source: "src/sdk/runSdk.ts",
        requires: "ad placement and readiness",
    },
    {
        id: "shop",
        sdk: "shop",
        summary: "Catalog, orders, verified purchases, history, and refunds.",
        safety: "player-gesture",
        source: "src/sdk/featureLab.ts",
        requires: "server shop config",
    },
    {
        id: "iap",
        sdk: "iap",
        summary: "Currencies, direct purchases, subscriptions, and purchase history.",
        safety: "paid-or-billed",
        source: "src/sdk/featureLab.ts",
        requires: "configured products; real in Playground",
    },
    {
        id: "entitlements",
        sdk: "entitlements",
        summary: "Owned quantities, idempotent consumption, and ledger reconciliation.",
        safety: "configured-write",
        source: "src/sdk/featureLab.ts",
    },
    {
        id: "creator-credits",
        sdk: "credits",
        summary: "Generation balance, estimates, plans, paywall, and retry policy.",
        safety: "paid-or-billed",
        source: "additional_features/client/generation.ts",
        requires: "explicit player action",
    },
    {
        id: "stats",
        sdk: "stats",
        summary: "Server-backed player counters and totals.",
        safety: "configured-write",
        source: "src/sdk/featureLab.ts",
    },
    {
        id: "leaderboards",
        sdk: "leaderboard",
        summary: "Score submission, rank, pages, and podium reads.",
        safety: "configured-write",
        source: "additional_features/client/progression.ts",
        requires: "leaderboard config",
    },
    {
        id: "collectibles",
        sdk: "collectibles",
        summary: "Collectible cards, VIP status, and claims.",
        safety: "configured-write",
        source: "src/sdk/featureLab.ts",
        requires: "collectibles config",
    },
    {
        id: "simulation",
        sdk: "simulation",
        summary: "Authoritative entities, recipes, active runs, and state subscriptions.",
        safety: "configured-write",
        source: "additional_features/client/progression.ts",
        requires: "simulation configs",
    },
    {
        id: "social",
        sdk: "social",
        summary: "Share links, QR codes, files, and social post composition.",
        safety: "player-gesture",
        source: "src/sdk/featureLab.ts",
    },
    {
        id: "clips",
        sdk: "clips",
        summary: "Consent-aware gameplay recording, screenshots, and publishing.",
        safety: "player-gesture",
        source: "additional_features/client/content.ts",
    },
    {
        id: "ugc",
        sdk: "ugc",
        summary: "Moderated creation, discovery, collaboration, reports, follows, and voting.",
        safety: "configured-write",
        source: "additional_features/client/content.ts",
        requires: "UGC policy and config",
    },
    {
        id: "video",
        sdk: "video",
        summary: "Host-native video and picture-in-picture sessions.",
        safety: "player-gesture",
        source: "additional_features/client/content.ts",
    },
    {
        id: "text-generation",
        sdk: "textGen",
        summary: "Prompt, chat, streaming, and model discovery.",
        safety: "paid-or-billed",
        source: "additional_features/client/generation.ts",
        requires: "explicit player action and moderation",
    },
    {
        id: "image-generation",
        sdk: "imageGen",
        summary: "Image, depth, cutout, upscale, and job workflows.",
        safety: "paid-or-billed",
        source: "additional_features/client/generation.ts",
        requires: "explicit player action and moderation",
    },
    {
        id: "sprite-generation",
        sdk: "spriteGen",
        summary: "Sprites, animation, character workflows, models, and cost estimates.",
        safety: "paid-or-billed",
        source: "additional_features/client/generation.ts",
        requires: "explicit player action and moderation",
    },
    {
        id: "video-generation",
        sdk: "videoGen",
        summary: "Video generation and job lifecycle.",
        safety: "paid-or-billed",
        source: "additional_features/client/generation.ts",
        requires: "explicit player action and moderation",
    },
    {
        id: "3d-generation",
        sdk: "threeDGen",
        summary: "3D generation, remeshing, rigging, animation, and job lifecycle.",
        safety: "paid-or-billed",
        source: "additional_features/client/generation.ts",
        requires: "explicit player action and moderation",
    },
    {
        id: "avatar-3d",
        sdk: "loadAvatar3dAsync / avatar editor helpers",
        summary: "Resolve and edit the player avatar for 3D presentation.",
        safety: "read-only",
        source: "additional_features/client/generation.ts",
    },
    {
        id: "multiplayer",
        sdk: "realtime / mp-server",
        summary: "Realtime rooms plus server-authoritative room logic and services.",
        safety: "server-only",
        source: "additional_features/multiplayer/realtimeClient.ts",
        requires: "room server config/build",
    },
    {
        id: "syncplay",
        sdk: "syncplay",
        summary: "Deterministic, input-synchronized multiplayer runtime and tooling.",
        safety: "server-only",
        source: "additional_features/multiplayer/syncplay.ts",
        requires: "determinism certification and room config",
    },
] as const satisfies readonly CapabilityDefinition[];

export function getCapabilityDefinition(id: string): CapabilityDefinition | undefined {
    return RUN_CAPABILITIES.find((capability) => capability.id === id);
}
