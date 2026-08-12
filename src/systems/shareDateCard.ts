export interface DateShareCardInput {
    personId: string;
    personName: string;
    personColor: string;
    spark: number;
    affectionGained: number;
    totalAffection: number;
    affectionTier: string;
    romanceScore: number;
    confessed: boolean;
    accepted: boolean;
}

export interface DateShareCard {
    blob: Blob;
    caption: string;
    filename: string;
}

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1350;
const FONT = '"Arial Rounded MT Bold", "Trebuchet MS", sans-serif';

function roundedRect(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
): void {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
}

function drawHeart(context: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
    context.save();
    context.translate(x, y);
    context.scale(size / 32, size / 32);
    context.beginPath();
    context.moveTo(16, 28);
    context.bezierCurveTo(13, 24, 3, 17, 3, 10);
    context.bezierCurveTo(3, 1, 14, 0, 16, 7);
    context.bezierCurveTo(18, 0, 29, 1, 29, 10);
    context.bezierCurveTo(29, 17, 19, 24, 16, 28);
    context.fillStyle = color;
    context.fill();
    context.restore();
}

function drawMetric(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    label: string,
    value: string,
    accent: string,
): void {
    roundedRect(context, x, y, width, 154, 30);
    context.fillStyle = "rgba(29, 20, 52, 0.78)";
    context.fill();
    context.strokeStyle = "rgba(255, 255, 255, 0.18)";
    context.lineWidth = 3;
    context.stroke();

    context.fillStyle = "rgba(255, 250, 241, 0.68)";
    context.font = `900 22px ${FONT}`;
    context.letterSpacing = "3px";
    context.fillText(label, x + 28, y + 43);
    context.letterSpacing = "0px";

    context.fillStyle = accent;
    context.font = `900 58px ${FONT}`;
    context.fillText(value, x + 28, y + 116);
}

function sparkReading(spark: number): string {
    if (spark >= 180) return "Unforgettable";
    if (spark >= 120) return "Electric";
    if (spark >= 70) return "Warm";
    return "A little shy";
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.decoding = "async";
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Could not load share-card art: ${src}`));
        image.src = new URL(src, document.baseURI).href;
    });
}

function drawContainedImage(
    context: CanvasRenderingContext2D,
    image: HTMLImageElement,
    x: number,
    y: number,
    width: number,
    height: number,
): void {
    const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    context.drawImage(image, x + (width - drawWidth) / 2, y + height - drawHeight, drawWidth, drawHeight);
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("The browser could not encode the date card."));
        }, "image/png");
    });
}

export async function createDateShareCard(input: DateShareCardInput): Promise<DateShareCard> {
    await document.fonts?.ready;

    const canvas = document.createElement("canvas");
    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable.");

    const background = context.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
    background.addColorStop(0, "#231634");
    background.addColorStop(0.5, "#432746");
    background.addColorStop(1, input.personColor);
    context.fillStyle = background;
    context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

    const glow = context.createRadialGradient(820, 470, 20, 820, 470, 560);
    glow.addColorStop(0, "rgba(255, 237, 190, 0.34)");
    glow.addColorStop(1, "rgba(255, 237, 190, 0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

    context.save();
    context.globalAlpha = 0.2;
    const petals: Array<readonly [number, number, number]> = [
        [80, 220, -0.5],
        [940, 80, 0.7],
        [998, 670, -0.8],
        [610, 1110, 0.35],
        [110, 1160, -0.2],
    ];
    for (const [x, y, rotation] of petals) {
        context.save();
        context.translate(x, y);
        context.rotate(rotation);
        context.fillStyle = "#fff1eb";
        context.beginPath();
        context.ellipse(0, 0, 34, 15, 0, 0, Math.PI * 2);
        context.fill();
        context.restore();
    }
    context.restore();

    roundedRect(context, 68, 60, 492, 106, 34);
    context.fillStyle = "rgba(255, 250, 241, 0.94)";
    context.fill();
    context.fillStyle = "#5b3f84";
    context.font = `900 48px ${FONT}`;
    context.fillText("Koi no Yokan", 98, 123);
    drawHeart(context, 500, 88, 38, "#f06d86");

    context.fillStyle = "rgba(255, 250, 241, 0.68)";
    context.font = `900 22px ${FONT}`;
    context.letterSpacing = "5px";
    context.fillText("A DATE WITH", 72, 262);
    context.letterSpacing = "0px";
    context.fillStyle = "#fffaf1";
    context.font = `900 76px ${FONT}`;
    context.fillText(input.personName, 68, 347);
    context.fillStyle = "#ffe4a7";
    context.font = `900 34px ${FONT}`;
    context.fillText(sparkReading(input.spark), 72, 397);

    try {
        const portrait = await loadImage(`images/cast/${input.personId}_figure.png`);
        context.save();
        context.shadowColor = "rgba(11, 6, 18, 0.58)";
        context.shadowBlur = 38;
        context.shadowOffsetY = 20;
        drawContainedImage(context, portrait, 642, 120, 360, 1065);
        context.restore();
    } catch (error) {
        console.warn("[shareCard] portrait unavailable", error);
        context.fillStyle = "rgba(255, 250, 241, 0.18)";
        context.beginPath();
        context.arc(822, 500, 150, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "#fffaf1";
        context.font = `900 160px ${FONT}`;
        context.textAlign = "center";
        context.fillText(input.personName.slice(0, 1), 822, 552);
        context.textAlign = "left";
    }

    const integer = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
    drawMetric(context, 72, 470, 258, "SPARK", integer.format(input.spark), "#ffe178");
    drawMetric(context, 352, 470, 258, "AFFECTION", `+${integer.format(input.affectionGained)}`, "#ff9dae");
    drawMetric(context, 72, 648, 538, "ROMANCE SCORE", integer.format(input.romanceScore), "#fffaf1");

    roundedRect(context, 72, 826, 538, 214, 34);
    context.fillStyle = "rgba(255, 250, 241, 0.9)";
    context.fill();
    context.fillStyle = "#493554";
    context.font = `900 22px ${FONT}`;
    context.letterSpacing = "3px";
    context.fillText("WHERE WE STAND", 104, 878);
    context.letterSpacing = "0px";
    context.fillStyle = "#2c2136";
    context.font = `900 46px ${FONT}`;
    context.fillText(`${integer.format(input.totalAffection)} affection`, 104, 945);
    context.fillStyle = "#86516e";
    context.font = `900 28px ${FONT}`;
    const ending = input.confessed ? (input.accepted ? "They said yes." : "Not yet.") : input.affectionTier;
    context.fillText(ending, 104, 995);

    context.strokeStyle = "rgba(255, 250, 241, 0.34)";
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(72, 1198);
    context.lineTo(1008, 1198);
    context.stroke();
    context.fillStyle = "#fffaf1";
    context.font = `900 28px ${FONT}`;
    context.fillText("Can you read the room?", 72, 1257);
    context.fillStyle = "rgba(255, 250, 241, 0.7)";
    context.font = `800 24px ${FONT}`;
    context.textAlign = "right";
    context.fillText("run.world/koi-no-yokan", 1008, 1257);
    context.textAlign = "left";

    const filenameName = input.personName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    const caption = `My date with ${input.personName} was ${sparkReading(input.spark).toLowerCase()}. Spark ${integer.format(input.spark)}, +${integer.format(input.affectionGained)} affection, romance score ${integer.format(input.romanceScore)}.`;
    return {
        blob: await canvasBlob(canvas),
        caption,
        filename: `koi-no-yokan-date-${filenameName || "result"}.png`,
    };
}

export function downloadDateShareCard(card: DateShareCard): void {
    const url = URL.createObjectURL(card.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = card.filename;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
