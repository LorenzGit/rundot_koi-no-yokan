import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { episodes } from "./festival-episodes.mjs";

const videoStudioRoot = dirname(fileURLToPath(import.meta.url));
const packageRoot = dirname(videoStudioRoot);
const outputRoot = join(videoStudioRoot, "lorebot-world");
const archivePath = join(videoStudioRoot, "koi-no-yokan-three-evenings-lorebot.zip");
const idPattern = /^[a-z0-9][a-z0-9-]*$/;
const ttsPausePattern = /(?:\.{3}|—|!!|\?!|!\?)/;
const requiredEpisodeCharacters = ["rin", "haruto", "kaede", "kaito"];
const safeRoles = new Set([
    "character-portrait",
    "character-voice-sample",
    "location-ref",
    "prop-ref",
    "style-ref",
    "show-bible",
    "scene-storyboard",
    "scene-video",
]);

const characters = [
    {
        sourceId: "mizuki",
        name: "Mizuki",
        descriptor:
            "Young Japanese woman and artist with long wavy dark-teal hair, soft features, and an introspective gaze.",
        defaultOutfit: "Ivory cardigan over a light dress with understated artist-chic accessories.",
        visualConstraints: {
            hairColor: "dark teal",
            mustPreserve: ["long wavy hair", "ivory cardigan", "gentle anime character design"],
        },
        personality:
            "Observant, creative, kind, and conflict-avoidant; speaks most honestly through unfinished drawings.",
    },
    {
        sourceId: "rin",
        name: "Rin",
        descriptor:
            "Young Japanese woman with vivid auburn hair tied back with a ribbon and a direct, expressive gaze.",
        defaultOutfit: "Red off-shoulder top, cream wide-leg trousers, and a small shoulder bag.",
        visualConstraints: {
            hairColor: "auburn",
            mustPreserve: ["hair ribbon", "red off-shoulder top", "cream trousers"],
        },
        personality: "Blunt, defensive, funny, and fiercely warm once she decides someone matters.",
    },
    {
        sourceId: "haruto",
        name: "Haruto",
        descriptor: "Young Japanese man with tousled black hair, a calm expression, and relaxed posture.",
        defaultOutfit: "Blue denim jacket over a white shirt with dark trousers.",
        visualConstraints: {
            hairColor: "black",
            mustPreserve: ["tousled hair", "blue denim jacket", "white shirt"],
        },
        personality: "Patient, perceptive, and difficult to rattle; notices what people leave unsaid.",
    },
    {
        sourceId: "sora",
        name: "Sora",
        descriptor: "Athletic young Japanese man with short blond hair, bright energy, and an easy grin.",
        defaultOutfit: "White athletic tank, navy shorts, and a blue jacket tied at the waist.",
        visualConstraints: {
            hairColor: "blond",
            mustPreserve: ["athletic build", "white tank", "blue waist jacket"],
        },
        personality: "Competitive, kinetic, playful, and incapable of letting a quiet mood stay solemn for long.",
    },
    {
        sourceId: "reina",
        name: "Reina",
        descriptor: "Elegant young Japanese singer with long wavy black hair and poised stage presence.",
        defaultOutfit: "Fitted red evening dress with red heels.",
        visualConstraints: {
            hairColor: "black",
            mustPreserve: ["long wavy hair", "red evening dress", "elegant posture"],
        },
        personality: "Confident, perceptive, and theatrical; uses performance as both revelation and armor.",
    },
    {
        sourceId: "kaito",
        name: "Kaito",
        descriptor: "Stylish young Japanese man with dark hair, warm tan skin, and a composed host's smile.",
        defaultOutfit: "Tailored black shirt and black trousers.",
        visualConstraints: {
            hairColor: "dark brown",
            mustPreserve: ["all-black outfit", "composed posture", "warm smile"],
        },
        personality:
            "Socially perceptive, discreet, and gently mischievous; creates openings for other people to connect.",
    },
    {
        sourceId: "kaede",
        name: "Kaede",
        descriptor: "Athletic young Japanese woman with a long brown ponytail and an upbeat, focused expression.",
        defaultOutfit: "Teal athletic top, dark leggings, and bright teal running shoes.",
        visualConstraints: {
            hairColor: "brown",
            mustPreserve: ["long ponytail", "teal athletic top", "running shoes"],
        },
        personality: "Practical, energetic, teasing, and supportive without becoming sentimental.",
    },
    {
        sourceId: "ren",
        name: "Ren",
        descriptor: "Quiet young Japanese man with black hair tied in a small bun and a thoughtful expression.",
        defaultOutfit: "Dark charcoal shirt, olive trousers, and a white towel draped at the neck.",
        visualConstraints: {
            hairColor: "black",
            mustPreserve: ["small hair bun", "charcoal shirt", "white neck towel"],
        },
        personality: "Reserved, trustworthy, and observant; believes privacy should never become isolation.",
    },
].map((character) => ({
    ...character,
    characterType: "humanoid",
    files: { portrait: `characters/${character.sourceId}/portrait.png` },
}));

const locations = [
    {
        sourceId: "sakura-plaza",
        name: "Sakura Plaza",
        description: "A tranquil urban plaza at pink dusk, framed by flowering cherry trees and reflective water.",
        interiorExterior: "exterior",
    },
    {
        sourceId: "beach-terrace",
        name: "Beach Terrace",
        description: "A breezy seaside terrace at golden hour with open water, pale railings, and long blue shadows.",
        interiorExterior: "exterior",
    },
    {
        sourceId: "la-dolce-vita",
        name: "La Dolce Vita",
        description:
            "An intimate Italian restaurant glowing with amber light, candles, flowers, and polished dark wood.",
        interiorExterior: "interior",
    },
].map((location) => ({
    ...location,
    aspectRatio: "9:16",
    files: { ref: `locations/${location.sourceId}/ref.png` },
}));

const props = [
    ["bouquet", "Flower Bouquet", "A romantic bouquet wrapped in pale paper."],
    ["bubble-tea", "Bubble Tea", "A bright takeaway cup of bubble tea."],
    ["cake", "Celebration Cake", "A small decorated cake for the final gathering."],
    ["coffee", "Coffee", "A warm ceramic cup of coffee."],
    ["film-reel", "Film Reel", "A vintage film reel evoking shared memories."],
    ["letter", "Residency Letter", "Mizuki's folded artist-residency acceptance letter."],
    ["mixtape", "Mixtape", "A handmade music tape with a personal paper label."],
    ["plushie", "Plushie", "A soft, whimsical keepsake plushie."],
    ["ring-box", "Ring Box", "A small velvet jewelry box used as a visual misdirect."],
    ["sketchbook", "Sketchbook", "Mizuki's worn private sketchbook."],
    ["sports-bottle", "Sports Bottle", "A teal sports bottle used during the beach race."],
    ["telescope", "Telescope", "A compact stargazing telescope."],
    ["tickets", "Two Tickets", "Two paper tickets representing an invitation into Mizuki's future."],
    ["umbrella", "Umbrella", "A clear rain umbrella for a quiet shared walk."],
].map(([sourceId, name, description]) => ({
    sourceId,
    name,
    description,
    files: { ref: `props/${sourceId}/ref.png` },
}));

const assetSpecs = [
    {
        source: "assets/covers/series-cover.jpg",
        path: "world-art/cover.jpg",
        role: "show-bible",
    },
    {
        source: "assets/covers/menu-sakura-reference.png",
        path: "style/style-ref.png",
        role: "style-ref",
    },
    ...characters.map((character) => ({
        source: `assets/characters/${character.sourceId}/portrait.png`,
        path: character.files.portrait,
        role: "character-portrait",
        entityRef: character.sourceId,
    })),
    ...locations.map((location) => ({
        source: `assets/backgrounds/${
            location.sourceId === "sakura-plaza"
                ? "sakura-plaza"
                : location.sourceId === "beach-terrace"
                  ? "beach-terrace"
                  : "la-dolce-vita"
        }.png`,
        path: location.files.ref,
        role: "location-ref",
        entityRef: location.sourceId,
    })),
    ...props.map((prop) => ({
        source: `assets/props/${
            {
                "bubble-tea": "bubbletea",
                "film-reel": "filmreel",
                "ring-box": "ringbox",
                "sports-bottle": "sportsbottle",
            }[prop.sourceId] ?? prop.sourceId
        }.png`,
        path: prop.files.ref,
        role: "prop-ref",
        entityRef: prop.sourceId,
    })),
];

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function isSafeRelativePath(path) {
    return (
        typeof path === "string" &&
        path.length > 0 &&
        !path.startsWith("/") &&
        !path.includes("\\") &&
        path.split("/").every((segment) => segment && segment !== "." && segment !== "..")
    );
}

async function copyAsset(spec) {
    assert(isSafeRelativePath(spec.path), `Unsafe asset path: ${spec.path}`);
    assert(safeRoles.has(spec.role), `Unsupported asset role: ${spec.role}`);

    const sourcePath = join(packageRoot, spec.source);
    const destinationPath = join(outputRoot, spec.path);
    await mkdir(dirname(destinationPath), { recursive: true });
    await copyFile(sourcePath, destinationPath);

    const bytes = (await stat(destinationPath)).size;
    const sha256 = createHash("sha256")
        .update(await readFile(destinationPath))
        .digest("hex");

    return {
        path: spec.path,
        role: spec.role,
        ...(spec.entityRef ? { entityRef: spec.entityRef } : {}),
        bytes,
        sha256,
    };
}

function validateManifest(manifest) {
    assert(manifest.manifestVersion === 1, "manifestVersion must be 1");
    assert(manifest.project.format === "shorts", "Project format must be shorts");
    assert(manifest.episodes.length === 3, "Exactly three episodes are required");

    const entityIds = new Set();
    for (const entity of [
        ...manifest.entities.characters,
        ...manifest.entities.locations,
        ...manifest.entities.props,
    ]) {
        assert(idPattern.test(entity.sourceId), `Invalid entity ID: ${entity.sourceId}`);
        assert(!entityIds.has(entity.sourceId), `Duplicate entity ID: ${entity.sourceId}`);
        entityIds.add(entity.sourceId);
    }

    const episodeIds = new Set();
    for (const episode of manifest.episodes) {
        assert(idPattern.test(episode.sourceId), `Invalid episode ID: ${episode.sourceId}`);
        assert(!episodeIds.has(episode.sourceId), `Duplicate episode ID: ${episode.sourceId}`);
        episodeIds.add(episode.sourceId);
        assert(episode.scenes.length > 0 && episode.scenes.length <= 5, `${episode.sourceId} must have 1-5 scenes`);

        const indexes = new Set();
        const episodeCharacterRefs = new Set(episode.scenes.flatMap((scene) => scene.characterRefs ?? []));
        for (const characterId of requiredEpisodeCharacters) {
            assert(
                episodeCharacterRefs.has(characterId),
                `${episode.sourceId} is missing required character ${characterId}`,
            );
        }
        let runtimeSec = 0;
        for (const scene of episode.scenes) {
            assert(!indexes.has(scene.index), `Duplicate scene index in ${episode.sourceId}`);
            indexes.add(scene.index);
            assert(entityIds.has(scene.locationRef), `Unknown location: ${scene.locationRef}`);
            for (const ref of scene.characterRefs ?? []) {
                assert(entityIds.has(ref), `Unknown character: ${ref}`);
            }
            assert(scene.subShots?.length > 0, `Scene ${scene.index} has no sub-shots`);
            assert(
                scene.subShots.some((shot) => shot.dialogue?.trim()),
                `Scene ${scene.index} in ${episode.sourceId} has no dialogue`,
            );
            for (const shot of scene.subShots) {
                assert(shot.action?.trim(), `Scene ${scene.index} has a shot without action`);
                if (shot.dialogue) {
                    assert(shot.speaker, `Dialogue has no speaker in ${episode.sourceId}`);
                    assert(
                        ttsPausePattern.test(shot.dialogue),
                        `Dialogue lacks an exaggerated TTS pause: ${shot.dialogue}`,
                    );
                }
                if (shot.speaker) assert(entityIds.has(shot.speaker), `Unknown speaker: ${shot.speaker}`);
                runtimeSec += shot.durationSec ?? 0;
            }
        }
        assert(runtimeSec <= 120, `${episode.sourceId} exceeds 120 seconds (${runtimeSec}s)`);
    }

    const assetPaths = new Set();
    for (const asset of manifest.assets) {
        assert(isSafeRelativePath(asset.path), `Unsafe manifest asset path: ${asset.path}`);
        assert(!assetPaths.has(asset.path), `Duplicate asset path: ${asset.path}`);
        assetPaths.add(asset.path);
        assert(safeRoles.has(asset.role), `Unsupported manifest role: ${asset.role}`);
        assert(asset.bytes > 0, `Empty asset: ${asset.path}`);
        assert(/^[a-f0-9]{64}$/.test(asset.sha256), `Invalid SHA-256: ${asset.path}`);
    }
}

await mkdir(outputRoot, { recursive: true });
const assets = [];
for (const spec of assetSpecs) assets.push(await copyAsset(spec));

const manifest = {
    manifestVersion: 1,
    source: "koi-no-yokan-video-studio-handoff",
    sourceVersion: "1.16.3",
    exportedAt: new Date().toISOString(),
    schemaVersions: {
        world: "1",
        character: "1",
        location: "1",
        prop: "1",
        episode: "1",
    },
    world: {
        sourceId: "koi-no-yokan-three-evenings",
        title: "Koi no Yokan: Three Evenings",
        genre: ["romance", "cozy-drama", "anime"],
        tone: "Quiet, hopeful, gently funny, and emotionally direct.",
        premise:
            "Rin cannot stand careless, joking Haruto after he ruins her festival schedule, but three evenings with Kaede and Kaito reveal the thoughtful man behind her terrible first impression—and anger gradually becomes love.",
        stylePreset: "Polished cinematic anime romance",
        keywords: ["dating", "romance", "cozy", "cherry-blossoms", "seaside", "warm-candlelight"],
        stylePalette:
            "Dusk sakura pink, sea blue, warm restaurant gold, soft bloom, clean anime linework, expressive faces, cinematic depth of field.",
    },
    project: {
        sourceId: "koi-no-yokan-three-evenings",
        format: "shorts",
        targetEpisodeLengthSec: 90,
        aspectRatio: "9:16",
        resolution: "1080x1920",
    },
    entities: { characters, locations, props },
    episodes,
    assets,
};

validateManifest(manifest);
await writeFile(join(outputRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const temporaryArchive = join("/tmp", `koi-no-yokan-lorebot-${randomUUID()}.zip`);
const zipped = spawnSync("zip", ["-X", "-q", "-r", temporaryArchive, ".", "-x", "*.DS_Store", "__MACOSX/*"], {
    cwd: outputRoot,
    encoding: "utf8",
});
assert(zipped.status === 0, zipped.stderr || "zip failed");
await rename(temporaryArchive, archivePath);

const archiveIntegrity = spawnSync("unzip", ["-tqq", archivePath], {
    encoding: "utf8",
});
assert(archiveIntegrity.status === 0, archiveIntegrity.stderr || "ZIP integrity check failed");

const archiveListing = spawnSync("unzip", ["-Z1", archivePath], {
    encoding: "utf8",
});
assert(archiveListing.status === 0, archiveListing.stderr || "ZIP listing failed");
const archivedPaths = new Set(archiveListing.stdout.trim().split("\n"));
assert(archivedPaths.has("manifest.json"), "ZIP is missing root manifest.json");
assert(
    ![...archivedPaths].some((path) => path.includes("__MACOSX") || path.endsWith(".DS_Store")),
    "ZIP contains macOS metadata",
);

for (const asset of assets) {
    assert(archivedPaths.has(asset.path), `ZIP is missing ${asset.path}`);
    const extracted = spawnSync("unzip", ["-p", archivePath, asset.path], {
        encoding: null,
        maxBuffer: 64 * 1024 * 1024,
    });
    assert(extracted.status === 0, `Could not read ${asset.path} from ZIP`);
    assert(extracted.stdout.length === asset.bytes, `ZIP byte mismatch: ${asset.path}`);
    assert(
        createHash("sha256").update(extracted.stdout).digest("hex") === asset.sha256,
        `ZIP hash mismatch: ${asset.path}`,
    );
}

const episodeDurations = episodes.map((episode) => ({
    id: episode.sourceId,
    seconds: episode.scenes.reduce(
        (episodeTotal, scene) =>
            episodeTotal + scene.subShots.reduce((sceneTotal, shot) => sceneTotal + (shot.durationSec ?? 0), 0),
        0,
    ),
}));

console.log(
    JSON.stringify(
        {
            archivePath,
            archiveBytes: (await stat(archivePath)).size,
            assets: assets.length,
            characters: characters.length,
            locations: locations.length,
            props: props.length,
            episodes: episodeDurations,
        },
        null,
        2,
    ),
);
