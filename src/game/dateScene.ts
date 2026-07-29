/**
 * The date scene: painted location, two cast members standing on its floor,
 * and the pantomime layer that carries the whole conversation.
 *
 * Nobody speaks. Two thought bubbles and the characters' body language are the
 * only channel, so this scene owns all of the readability: bubble glyphs,
 * lean-in and flinch, blush, and the floating note after each move.
 *
 * The sim is authoritative — this scene renders it and reports taps back up.
 * No React state crosses per frame.
 */
import { Assets, Container, Graphics, MeshPlane, Sprite, Text, Texture, type Application } from "pixi.js";
import type { Stage } from "./stage.ts";
import { DateSim, type DateOutcome } from "./sim/dateSim.ts";
import { CAST_BY_ID, TOPIC_GLYPH } from "./data/world.ts";
import type { CastMemberDef, Expression, LocationDef, PoseEntry, SparkTick, TopicId } from "./data/types.ts";
import { EXPRESSIONS } from "./data/types.ts";
import castPoses from "./data/cast-poses.json";
import { placeBackdrop, REFERENCE_CM } from "./data/backdrop.ts";
import { TAIL_SECONDS } from "./data/actions.ts";
import { NoiseRandom } from "./noiseRandom.ts";

export interface Scene {
    destroy(): void;
}

/**
 * Idle-animation jitter. Only decides where each actor's breathing cycle
 * starts, so any seed is fine — but it goes through NoiseRandom, like all
 * randomness in this project, so the scene stays replayable frame-for-frame.
 */
const idleNoise = new NoiseRandom();
/**
 * Design units the cast stands above the painted ground line. The paintings put
 * their horizon where a photograph would; standing exactly on it left the pair
 * sitting low in the frame with a lot of empty floor under them.
 */
const CAST_LIFT_PORTRAIT = 30;
/**
 * Rotated, the frame is short and the HUD owns the top of it, so the pair sit
 * almost on the painted ground line: lifting them the portrait amount left
 * them floating in the middle of the composition with unused pavement below.
 */
const CAST_LIFT_LANDSCAPE = 2;
/**
 * Clear air between a side-anchored thought balloon and the head, in design
 * units. Wide enough that the two trailing dots can float in it — a narrower
 * gap had the dots overlapping the cheek.
 */
const SIDE_GAP = 24;
/** Scatter for the mood particles. Cosmetic only, so it never touches the sim's seeded stream. */
const burstNoise = new NoiseRandom();

export interface DateSceneOptions {
    sim: DateSim;
    partner: CastMemberDef;
    playerId: string;
    location: LocationDef;
    /** Called every frame with the live gauges so the HUD can mirror them. */
    onTick(sim: DateSim): void;
    /**
     * Called when the EVENING ends, which is not the moment the sim runs out of
     * moves: the final move's result has to stay on screen until the player
     * dismisses it. GameCanvas fires this from that dismissal instead.
     */
    onFinished(sim: DateSim): void;
}

/** How the partner visibly takes a move, shown in their bubble as it lands. */
/**
 * How a single second of a move reads on their face.
 *
 * Pools rather than constants: three fixed faces meant every roll of every move
 * looked identical, so the bubble stopped carrying information and became
 * wallpaper. Same meaning, different shade each second.
 */
const TICK_FACES = {
    plus: ["😊", "😄", "😌", "☺️", "🥰"],
    zero: ["😐", "😶", "🤔", "😑", "🙄"],
    minus: ["😬", "😕", "😖", "😞", "😳"],
} as const;

/** Occasionally paired with a face to say more than the face alone can. */
const TICK_TAGS = {
    plus: ["💗", "✨", "💞"],
    zero: ["…"],
    minus: ["💦", "❄️"],
} as const;

/**
 * Every expression pose is drawn in the same three-quarter view, facing
 * viewer-LEFT. That is a property of the pose sheets, not of the character, so
 * it lives here as one constant rather than as a per-cast field.
 *
 * Measured, not eyeballed: in a three-quarter view the face's skin sits toward
 * the side the character is looking, so comparing the centroid of skin-toned
 * pixels in the head band against the head's own centre gives the direction.
 * Seven of the eight land between -5% and -17% (the eighth is dark-haired and
 * yields too few skin pixels to call). Judging it by eye is what got it
 * backwards and turned the pair away from each other.
 */
const POSE_FACING: "left" | "right" = "left";

/** True when the pose has to be flipped for this person to face `want`. */
function needsMirror(want: "left" | "right"): boolean {
    return POSE_FACING !== want;
}

/**
 * The soft contact shadow, drawn at runtime.
 *
 * There used to be a baked *_shadow.png per character: a per-column contact
 * stamp measured from that exact cutout. Six expressions per character means
 * six silhouettes and six different foot positions, so a baked stamp is wrong
 * five times out of six — and forty-eight more files to keep in sync. Stacked
 * ellipses cost nothing and fit whichever pose is on screen.
 *
 * Graphics rather than a gradient texture: the falloff only needs a handful of
 * rings to read, and this avoids a canvas upload entirely.
 */
function drawSoftShadow(gfx: Graphics, width: number, height: number): void {
    gfx.clear();
    // More rings than the falloff strictly needs, because the ramp is what
    // sells it: five steps read as concentric bands, nine dissolve.
    const rings = 9;
    for (let i = rings; i >= 1; i--) {
        const t = i / rings;
        gfx.ellipse(0, 0, (width / 2) * t, (height / 2) * t).fill({
            color: 0x120817,
            // Faint at the rim, dense under the soles. The exponent is what
            // keeps the outer rings nearly invisible while the core still darkens.
            alpha: 0.035 + (1 - t) ** 1.7 * 0.26,
        });
    }
}

/** One pose: its mesh and the deformation data that goes with its silhouette. */
interface Pose {
    mesh: MeshPlane;
    rest: Float32Array;
    weights: Float32Array;
    /** Sprite pixels, this pose's own dimensions. */
    w: number;
    h: number;
    crownY: number;
    bodyPx: number;
}

/**
 * One character on the floor: a soft shadow underneath, the current pose above,
 * and a bubble tethered to their head.
 *
 * Six expressions are built up front and toggled by visibility. Swapping the
 * texture on a single mesh would mean rebuilding its geometry every time,
 * because each pose is a different size and needs its own rest grid.
 */
class Actor {
    readonly root = new Container();
    readonly bubble: ThoughtBubble;
    private readonly poses = new Map<Expression, Pose>();
    private current: Expression = "neutral";
    private readonly shadow = new Graphics();
    private readonly baseX: number;
    private readonly pxPerCm: number;
    private readonly heightCm: number;
    private readonly mirrored: boolean;
    private readonly footY: number;
    private readonly bubbleSide: "top" | "left" | "right";
    /** Animated lean toward or away from the other person. */
    private lean = 0;
    private leanTarget = 0;
    private breathPhase = idleNoise.float(0, Math.PI * 2);
    private swayPhase = idleNoise.float(0, Math.PI * 2);

    constructor(
        textures: Map<Expression, Texture>,
        entries: Record<string, PoseEntry>,
        opts: {
            x: number;
            footY: number;
            pxPerCm: number;
            mirrored: boolean;
            heightCm: number;
            bubbleSide: "top" | "left" | "right";
        },
    ) {
        this.pxPerCm = opts.pxPerCm;
        this.heightCm = opts.heightCm;
        this.mirrored = opts.mirrored;
        this.footY = opts.footY;
        this.bubbleSide = opts.bubbleSide;

        this.root.addChild(this.shadow);

        for (const [expression, texture] of textures) {
            const entry = entries[expression];
            if (!entry) continue;
            const pose = this.buildPose(texture, entry);
            this.poses.set(expression, pose);
            this.root.addChild(pose.mesh);
            pose.mesh.visible = expression === "neutral";
        }

        this.root.x = opts.x;
        this.root.y = opts.footY;
        this.baseX = this.root.x;
        this.layoutShadow();

        this.bubble = new ThoughtBubble();
        this.anchorBubble();
    }

    /** Tether the bubble to the crown of the pose actually on screen. */
    private anchorBubble(): void {
        // Head half-width: the sprite's full width counts arms and props, and a
        // raised hand is not the head. A twentieth of a standing height either
        // side of the centreline is a close enough skull.
        const headHalf = Math.max(14, this.headHeight() * 0.055);
        this.bubble.setAnchor(this.baseX, this.footY - this.headHeight(), headHalf, this.bubbleSide);
    }

    private buildPose(texture: Texture, entry: PoseEntry): Pose {
        // Scale from crown-to-sole, never from the sprite's height: the sprite
        // may include a raised arm or a hat, and dividing by that shrinks the
        // body until a tall man renders shorter than a short woman.
        const scale = (this.heightCm * this.pxPerCm) / entry.bodyPx;
        const mesh = new MeshPlane({ texture, verticesX: 4, verticesY: 12 });
        mesh.scale.set(scale);
        mesh.y = -entry.h * scale;
        // Centred on the actor's own origin, so every pose stands on the same
        // spot however wide its silhouette happens to be.
        mesh.x = (-entry.w * scale) / 2;

        if (this.mirrored) {
            mesh.scale.x = -scale;
            mesh.x = (entry.w * scale) / 2;
        }

        const positions = mesh.geometry.getBuffer("aPosition").data as Float32Array;
        const rest = Float32Array.from(positions);
        const weights = new Float32Array(positions.length / 2);
        for (let i = 0; i < weights.length; i++) {
            // Normalised height, 0 at the feet. Smoothstep so the hips barely
            // register and the movement reads as chest and shoulders.
            const t = 1 - (rest[i * 2 + 1] as number) / entry.h;
            const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
            weights[i] = clamped * clamped * (3 - 2 * clamped);
        }
        return { mesh, rest, weights, w: entry.w, h: entry.h, crownY: entry.crownY, bodyPx: entry.bodyPx };
    }

    /** Swap which pose is on screen. Unknown expressions fall back to neutral. */
    setExpression(expression: Expression): void {
        const next = this.poses.has(expression) ? expression : "neutral";
        if (next === this.current) return;
        const previous = this.poses.get(this.current);
        if (previous) previous.mesh.visible = false;
        this.current = next;
        const pose = this.poses.get(next);
        if (pose) pose.mesh.visible = true;
        this.layoutShadow();
        this.anchorBubble();
    }

    private pose(): Pose | undefined {
        return this.poses.get(this.current);
    }

    private headHeight(): number {
        const pose = this.pose();
        if (!pose) return 0;
        const scale = (this.heightCm * this.pxPerCm) / pose.bodyPx;
        return (pose.h - pose.crownY) * scale;
    }

    /**
     * Sized to the pose actually on screen. A wider stance casts a wider
     * shadow, which is the whole reason for doing this at runtime.
     */
    private layoutShadow(): void {
        const pose = this.pose();
        if (!pose) return;
        const scale = (this.heightCm * this.pxPerCm) / pose.bodyPx;
        const width = pose.w * scale;
        drawSoftShadow(this.shadow, width * 1.5, width * 0.44);
        // Sits up under the soles rather than pooling below them: anchored at
        // the foot line the ellipse's lower half read as a puddle in front.
        this.shadow.y = -width * 0.1;
    }

    /** Lean in when it is going well, pull back when the air is too charged. */
    setPosture(closeness: number): void {
        this.leanTarget = closeness;
    }

    flinch(): void {
        this.lean -= 14;
    }

    /** Where to spawn particles: roughly sternum height, in stage coordinates. */
    chest(): { x: number; y: number; spread: number } {
        const pose = this.pose();
        if (!pose) return { x: this.root.x, y: this.root.y, spread: 40 };
        const scale = (this.heightCm * this.pxPerCm) / pose.bodyPx;
        const width = pose.w * scale;
        return { x: this.root.x, y: this.root.y - pose.h * scale * 0.55, spread: width };
    }

    update(dt: number): void {
        this.lean += (this.leanTarget - this.lean) * Math.min(1, dt * 3);
        this.root.x = this.baseX + this.lean;
        this.breathe(dt);
        this.bubble.update(dt);
    }

    /**
     * Breathing, as a deformation rather than a transform.
     *
     * Two slow waves at different rates so the loop never reads as a loop: a
     * rise that lifts the chest and shoulders, and a sway that drifts the upper
     * body side to side. Both are scaled by the per-vertex weight, so the feet
     * are mathematically incapable of leaving the floor.
     */
    private breathe(dt: number): void {
        this.breathPhase += dt * 1.15;
        this.swayPhase += dt * 0.63;
        const pose = this.pose();
        if (!pose) return;

        const rise = Math.sin(this.breathPhase) * pose.h * 0.006;
        const sway = Math.sin(this.swayPhase) * pose.h * 0.004;

        const buffer = pose.mesh.geometry.getBuffer("aPosition");
        const positions = buffer.data as Float32Array;
        for (let i = 0; i < pose.weights.length; i++) {
            const weight = pose.weights[i] as number;
            positions[i * 2] = (pose.rest[i * 2] as number) + sway * weight * weight;
            positions[i * 2 + 1] = (pose.rest[i * 2 + 1] as number) - rise * weight;
        }
        buffer.update();
    }

    destroy(): void {
        this.root.destroy({ children: true });
        this.bubble.root.destroy({ children: true });
    }
}

/** A Sims-style pictogram bubble. The only thing that tells you what they care about. */
class ThoughtBubble {
    readonly root = new Container();
    private readonly balloon = new Graphics();
    private readonly glyph: Text;
    private shown: TopicId | null = null;
    private pop = 0;
    /** Seconds an explicitly shown glyph stays put against the ambient topic. */
    private hold = 0;
    /**
     * Where the head is, in stage coordinates, and which side of it the balloon
     * floats on. "top" hovers above the crown; "left"/"right" sit beside the
     * cheek — landscape has no vertical room above the heads (the HUD owns it),
     * so there the trail points sideways instead of down.
     */
    private side: "top" | "left" | "right" = "top";
    private anchor = { x: 0, y: 0, headHalf: 16 };
    private halfWidth = 38;

    constructor() {
        this.glyph = new Text({
            text: "",
            style: { fontFamily: "system-ui, sans-serif", fontSize: 34, fill: 0x2a2030, align: "center" },
        });
        this.glyph.anchor.set(0.5);
        this.root.addChild(this.balloon, this.glyph);
        this.root.visible = false;
        this.drawBalloon();
    }

    /** Re-tether to the head: crown position, head half-width and which side. */
    setAnchor(x: number, y: number, headHalf: number, side: "top" | "left" | "right"): void {
        this.anchor = { x, y, headHalf };
        this.side = side;
        this.layoutSelf();
    }

    /**
     * Place the root from the anchor and the CURRENT balloon size. Runs after
     * every redraw, so a balloon that grows a second glyph grows OUTWARD — the
     * gap between balloon and head never changes under it.
     */
    private layoutSelf(): void {
        const { x, y, headHalf } = this.anchor;
        if (this.side === "top") {
            this.root.x = x;
            // Well clear of the crown: the balloon's bottom edge used to rest
            // on the hair and the dots ended up on the forehead.
            this.root.y = y - 46;
            return;
        }
        const dir = this.side === "left" ? -1 : 1;
        this.root.x = x + dir * (headHalf + SIDE_GAP + this.halfWidth);
        this.root.y = y + 26;
    }

    /**
     * Sized to its contents. One pictogram is often not enough to say what
     * someone is thinking — "music" and "delighted" together say far more than
     * either alone — so the balloon grows to fit two or three rather than
     * cramming them into a fixed circle.
     */
    private drawBalloon(): void {
        // Side balloons run a smaller glyph and tighter pad: every pixel of
        // width is distance pushed toward the screen edge or the action deck.
        this.glyph.style.fontSize = this.side === "top" ? 34 : 32;
        const width = this.side === "top" ? Math.max(76, this.glyph.width + 30) : Math.max(68, this.glyph.width + 14);
        const half = width / 2;
        this.halfWidth = half;
        this.balloon.clear();
        this.balloon
            .roundRect(-half, -34, width, 60, 26)
            .fill({ color: 0xfffdf8, alpha: 0.95 })
            .stroke({ color: 0x3a2f3d, width: 3, alpha: 0.85 });
        if (this.side === "top") {
            // Trailing dots down TOWARD the head, the Sims tell that this is a
            // thought — ending at the hairline, not on it.
            this.balloon
                .circle(0, 33, 7)
                .fill({ color: 0xfffdf8, alpha: 0.95 })
                .stroke({ color: 0x3a2f3d, width: 2.5 });
            this.balloon.circle(-3, 42, 4).fill({ color: 0xfffdf8, alpha: 0.9 }).stroke({ color: 0x3a2f3d, width: 2 });
        } else {
            // Same tell, sideways — but the dots FLOAT in the gap, touching
            // neither balloon nor cheek. Reaching the head is what put them on
            // the face.
            const dir = this.side === "left" ? 1 : -1;
            this.balloon
                .circle(dir * (half + 8), 8, 3)
                .fill({ color: 0xfffdf8, alpha: 0.95 })
                .stroke({ color: 0x3a2f3d, width: 1.5 });
            this.balloon
                .circle(dir * (half + 16), 15, 2)
                .fill({ color: 0xfffdf8, alpha: 0.9 })
                .stroke({ color: 0x3a2f3d, width: 1.5 });
        }
        this.layoutSelf();
    }

    show(topic: TopicId): void {
        // A held glyph outranks the ambient topic: while a move is playing out
        // the bubble is showing what you just DID, and the per-frame topic
        // update would otherwise overwrite it on the very next frame.
        if (this.hold > 0 || this.shown === topic) return;
        this.shown = topic;
        this.setGlyphs([TOPIC_GLYPH[topic]]);
    }

    /**
     * Show an arbitrary pictogram (an action's icon, or how it landed) and keep
     * it there. `Infinity` by design: the reaction is a record of what just
     * happened between them, and reverting to an unrelated topic glyph a few
     * seconds later threw that record away.
     */
    showGlyph(glyphs: string | string[], seconds = Number.POSITIVE_INFINITY): void {
        this.shown = null;
        this.hold = seconds;
        this.setGlyphs(Array.isArray(glyphs) ? glyphs : [glyphs]);
    }

    private setGlyphs(glyphs: string[]): void {
        this.glyph.text = glyphs.join(" ");
        this.root.visible = true;
        this.pop = 1;
        // Redraw AFTER the text so the balloon can measure it.
        this.drawBalloon();
    }

    hide(): void {
        this.shown = null;
        this.hold = 0;
        this.root.visible = false;
    }

    update(dt: number): void {
        if (this.hold > 0) this.hold = Math.max(0, this.hold - dt);
        if (!this.root.visible) return;
        this.pop = Math.max(0, this.pop - dt * 3);
        const scale = 1 + this.pop * 0.25;
        this.root.scale.set(scale);
        this.root.y += Math.sin(performance.now() / 620) * 0.06;
    }
}

/**
 * The little shower of marks that comes off someone when their mood moves.
 *
 * Reading a bar is work; seeing hearts lift off her is not. The particles are
 * plain Graphics rather than sprites because there are at most a couple of
 * dozen alive at once and they never need a texture — a filled circle tinted
 * warm or cold carries the whole message.
 */
class MoodBurst {
    readonly root = new Container();
    private readonly live: { node: Graphics; vx: number; vy: number; life: number; ttl: number }[] = [];

    /**
     * `delta` is the mood change: positive lifts warm marks, negative sinks
     * cold ones. `spread` is the figure's rendered width, so the shower covers
     * the body rather than a point.
     *
     * Sizes are design units, NOT multiples of the sprite's scale: the cast is
     * drawn small on a phone, and scaling the marks with the texture made them
     * sub-pixel specks that read as noise on the backdrop.
     */
    burst(x: number, y: number, delta: number, spread: number): void {
        const rising = delta > 0;
        const count = Math.min(16, 5 + Math.round(Math.abs(delta) * 0.8));
        for (let i = 0; i < count; i++) {
            const node = new Graphics();
            const radius = 2.4 + burstNoise.float(0, 3.6);
            node.circle(0, 0, radius).fill({
                color: rising ? 0xffe1ec : 0x93a6cc,
                alpha: rising ? 1 : 0.8,
            });
            // A soft halo so a mark still reads against a bright sunset.
            node.circle(0, 0, radius * 2.1).fill({
                color: rising ? 0xff9ec4 : 0x5f6f96,
                alpha: 0.28,
            });
            node.x = x + burstNoise.float(-spread * 0.45, spread * 0.45);
            node.y = y + burstNoise.float(-spread * 0.35, spread * 0.35);
            this.live.push({
                node,
                vx: burstNoise.float(-16, 16),
                // Good news floats up and off; bad news falls.
                vy: (rising ? -1 : 1) * (34 + burstNoise.float(0, 30)),
                life: 0,
                ttl: 0.8 + burstNoise.float(0, 0.7),
            });
            this.root.addChild(node);
        }
    }

    update(dt: number): void {
        for (let i = this.live.length - 1; i >= 0; i--) {
            const p = this.live[i];
            if (!p) continue;
            p.life += dt;
            if (p.life >= p.ttl) {
                p.node.destroy();
                this.live.splice(i, 1);
                continue;
            }
            p.node.x += p.vx * dt;
            p.node.y += p.vy * dt;
            p.vy += 26 * dt; // a little drag so risers slow and sinkers speed up
            p.node.alpha = 1 - p.life / p.ttl;
        }
    }

    destroy(): void {
        for (const p of this.live) p.node.destroy();
        this.live.length = 0;
        this.root.destroy({ children: true });
    }
}

/** The note that floats up after each action: "Exactly what they wanted." */
class FloatingNote {
    readonly root = new Container();
    private readonly text: Text;
    private life = 0;

    constructor() {
        this.text = new Text({
            text: "",
            style: {
                fontFamily: "system-ui, sans-serif",
                fontSize: 34,
                fontWeight: "800",
                fill: 0xffffff,
                stroke: { color: 0x2a1d2e, width: 5 },
                align: "center",
            },
        });
        this.text.anchor.set(0.5);
        this.root.addChild(this.text);
        this.root.visible = false;
    }

    play(note: string, tint: number, x: number, y: number, seconds = 1.6): void {
        this.text.text = note;
        this.text.style.fill = tint;
        this.root.position.set(x, y);
        this.root.visible = true;
        this.root.alpha = 1;
        this.life = seconds;
    }

    update(dt: number): void {
        if (!this.root.visible) return;
        this.life -= dt;
        this.root.y -= dt * 34;
        this.root.alpha = Math.max(0, Math.min(1, this.life));
        if (this.life <= 0) this.root.visible = false;
    }
}

const POSES = castPoses as unknown as Record<string, Record<string, PoseEntry>>;

/** Every expression a character has, loaded together so a swap never stalls. */
async function loadPoses(castId: string): Promise<Map<Expression, Texture>> {
    const entries = POSES[castId];
    if (!entries) throw new Error(`no poses for ${castId}`);
    const loaded = await Promise.all(
        EXPRESSIONS.filter((e) => entries[e]).map(async (expression) => {
            const entry = entries[expression] as PoseEntry;
            return [expression, await Assets.load<Texture>(entry.src)] as const;
        }),
    );
    return new Map(loaded);
}

/**
 * Start fetching tonight's textures the moment the player commits to the
 * date, not after the canvas exists: by the time the scene builds, the
 * backdrop and both cast sets are warm in the Pixi cache. Fire-and-forget —
 * a failed warm is logged by Assets, never thrown into navigation.
 */
export function warmDateAssets(partnerId: string, playerId: string, location: LocationDef): void {
    void Assets.load<Texture>(location.image).catch(() => undefined);
    for (const castId of [partnerId, playerId]) {
        const entries = POSES[castId];
        if (!entries) continue;
        for (const expression of EXPRESSIONS) {
            const entry = entries[expression] as PoseEntry | undefined;
            if (entry) void Assets.load<Texture>(entry.src).catch(() => undefined);
        }
    }
}

const VERDICT_TINT: Record<DateOutcome["verdict"], number> = {
    great: 0xffd76e,
    good: 0xa8ffb0,
    flat: 0xe6e0ee,
    bad: 0xff9a9a,
};

export async function createDateScene(
    app: Application,
    stage: Stage,
    opts: DateSceneOptions,
): Promise<
    Scene & {
        beginAction(actionIcon?: string): void;
        rest(): void;
        reactTick(tick: SparkTick): void;
        settle(outcome: DateOutcome): void;
    }
> {
    const { sim, partner, playerId, location } = opts;

    const [bgTexture, partnerTextures, playerTextures] = await Promise.all([
        Assets.load<Texture>(location.image),
        loadPoses(partner.id),
        loadPoses(playerId),
    ]);

    const root = new Container();
    stage.root.addChild(root);

    const backdrop = new Sprite(bgTexture);
    const world = new Container();
    const notes = new FloatingNote();
    const bursts = new MoodBurst();
    root.addChild(backdrop, world, bursts.root, notes.root);

    let player: Actor | null = null;
    let partnerActor: Actor | null = null;

    /** On-screen ground line, kept for the floating note and re-read on resize. */
    let groundY = 0;
    /** Horizontal centre of the visible stage, which landscape shifts left. */

    const layout = () => {
        const w = stage.designWidth();
        const h = stage.designHeight();

        // Cover the frame without distorting the painting, anchored so the
        // painting's own ground line lands on the screen's. Centring instead
        // puts the visible slice through the middle of the sky in landscape and
        // drops the floor off the bottom entirely.
        const placement = placeBackdrop(bgTexture.width, bgTexture.height, w, h, location.id);
        backdrop.scale.set(placement.scale);
        backdrop.x = placement.x;
        backdrop.y = placement.y;
        groundY = placement.groundY;

        const pxPerCm = placement.personHeight / REFERENCE_CM;

        player?.destroy();
        partnerActor?.destroy();
        world.removeChildren();

        const playerEntry = POSES[playerId];
        const partnerEntry = POSES[partner.id];
        if (!playerEntry || !partnerEntry) throw new Error("cast pose atlas is missing a character");

        // In landscape the action deck occupies a column down the right-hand
        // third, so the pair is centred on the visible stage rather than on the
        // viewport — centring on the viewport puts the partner behind the deck.
        const landscape = w / h >= 1;
        const stageCentre = landscape ? 0.33 : 0.5;
        // They are on a date, not queuing. Close enough to read as together;
        // the lean-in animation then closes the last of the gap when it is
        // going well.
        const spread = landscape ? 0.082 : 0.155;
        const castLift = landscape ? CAST_LIFT_LANDSCAPE : CAST_LIFT_PORTRAIT;

        // You stand on the left, so you should be turned right, and vice versa.
        // Mirror only when the art leans the wrong way — mirroring everyone on
        // one side regardless is what had the pair looking away from each other.
        // Bubbles float outboard: above the crown in portrait, beside the cheek
        // in landscape — there the HUD owns every pixel above the heads, so a
        // top bubble ended up either under the HUD or on top of a face.
        player = new Actor(playerTextures, playerEntry, {
            x: w * (stageCentre - spread),
            footY: groundY - castLift,
            pxPerCm,
            mirrored: needsMirror("right"),
            heightCm: CAST_BY_ID[playerId]?.heightCm ?? REFERENCE_CM,
            bubbleSide: landscape ? "left" : "top",
        });
        partnerActor = new Actor(partnerTextures, partnerEntry, {
            x: w * (stageCentre + spread),
            footY: groundY - castLift,
            pxPerCm,
            mirrored: needsMirror("left"),
            heightCm: partner.heightCm,
            bubbleSide: landscape ? "right" : "top",
        });

        // Whoever stands further back draws first.
        world.addChild(player.root, partnerActor.root, player.bubble.root, partnerActor.bubble.root);
    };

    layout();
    const offResize = stage.onResize(layout);

    const tick = () => {
        const dt = Math.min(0.05, app.ticker.deltaMS / 1000);
        sim.update(dt);

        // Posture reads the gauges: they lean in when it is going well and pull
        // back when the air is too charged for them.
        const closeness = (sim.mood / 100) * 26 * (sim.inBand() ? 1 : -0.5);
        partnerActor?.setPosture(-closeness);
        player?.setPosture(closeness * 0.5);

        partnerActor?.bubble.show(sim.topic);
        // The player's bubble is driven explicitly by beginAction and rest():
        // re-asserting it every frame here meant hide() was undone on the very
        // next tick and your last move hung over your head forever.

        player?.update(dt);
        partnerActor?.update(dt);
        notes.update(dt);
        bursts.update(dt);

        opts.onTick(sim);
    };
    app.ticker.add(tick);

    return {
        /** A move has started: show what you did, and clear their reaction. */
        beginAction(actionIcon?: string) {
            // You lean in as you make the move; they wait to see what it is.
            player?.setExpression("happy");
            if (actionIcon) player?.bubble.showGlyph(actionIcon);
            partnerActor?.bubble.showGlyph(["🤔"]);
        },

        /**
         * One second of the move just happened. Their bubble follows it live,
         * so the pantomime and the pips on the HUD are telling the same story
         * at the same moment.
         */
        reactTick(tick: SparkTick) {
            if (!partnerActor) return;
            const kind = tick > 0 ? "plus" : tick < 0 ? "minus" : "zero";
            const faces = TICK_FACES[kind];
            const tags = TICK_TAGS[kind];
            const glyphs: string[] = [faces[burstNoise.int(0, faces.length)] ?? faces[0]];

            // A second glyph roughly half the time, and on a good second it is
            // sometimes what they are thinking about rather than a generic tag.
            if (burstNoise.float(0, 1) < 0.5) {
                glyphs.push(
                    tick > 0 && burstNoise.float(0, 1) < 0.5
                        ? TOPIC_GLYPH[sim.topic]
                        : (tags[burstNoise.int(0, tags.length)] ?? tags[0]),
                );
            }
            partnerActor.bubble.showGlyph(glyphs);
            partnerActor.setExpression(sim.tickExpression(tick));

            const chest = partnerActor.chest();
            if (tick !== 0) bursts.burst(chest.x, chest.y, tick * 6, chest.spread);
        },

        /**
         * Back to waiting. Your bubble clears — you are not still doing the
         * thing — and theirs turns to whatever they would like to talk about
         * next, which is the one hint the player can act on before choosing.
         */
        rest() {
            partnerActor?.setExpression(sim.idleExpression());
            player?.setExpression("neutral");
            player?.bubble.hide();
            partnerActor?.bubble.hide();
            sim.rerollTopic();
            partnerActor?.bubble.showGlyph([TOPIC_GLYPH[sim.topic], "💬"]);
        },

        /** The move is over: settle the reaction and float the total. */
        settle(outcome: DateOutcome) {
            sim.hold(TAIL_SECONDS);
            partnerActor?.bubble.showGlyph(outcome.reaction);
            partnerActor?.setExpression(outcome.expression);
            if (outcome.verdict === "bad") partnerActor?.flinch();

            if (Math.round(outcome.spark) !== 0 && partnerActor) {
                const chest = partnerActor.chest();
                notes.play(
                    `${outcome.spark > 0 ? "+" : ""}${Math.round(outcome.spark)}`,
                    VERDICT_TINT[outcome.verdict],
                    chest.x + chest.spread * 0.62,
                    chest.y - chest.spread * 0.32,
                    1.8,
                );
            }
        },

        destroy() {
            app.ticker.remove(tick);
            offResize();
            player?.destroy();
            partnerActor?.destroy();
            root.destroy({ children: true });
        },
    };
}
