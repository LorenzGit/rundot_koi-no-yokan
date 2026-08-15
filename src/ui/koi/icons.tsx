/**
 * The app's drawn icons. The menu asked for real icons rather than emoji:
 * emoji render in the PLATFORM's typeface and colour, so the same button
 * looked different on every phone — and usually nothing like the art. These
 * are plain stroke paths in the current text colour, so they inherit whatever
 * the button is doing (accent gradient, disabled fade, active press).
 *
 * One shared 24px grid, 1.8px strokes, round caps — consistent weight across
 * the set is what makes them read as a family rather than clip art.
 */
export type IconName = "heart" | "book" | "gift" | "postcard" | "gear" | "share" | "play";

const PATHS: Record<IconName, string[]> = {
    heart: [
        "M12 20.5c-5.2-3.3-8.5-6.6-8.5-10.4 0-2.6 1.9-4.6 4.4-4.6 1.7 0 3.2.9 4.1 2.4.9-1.5 2.4-2.4 4.1-2.4 2.5 0 4.4 2 4.4 4.6 0 3.8-3.3 7.1-8.5 10.4Z",
    ],
    book: ["M6.5 4.5h10a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1Z", "M9.5 4.5v15"],
    gift: [
        "M4 9h16v10.5H4V9Z",
        "M12 9v10.5",
        "M3 5.5h18V9H3V5.5Z",
        "M12 5.5c-1.6-2.8-5.2-2.8-5.2 0",
        "M12 5.5c1.6-2.8 5.2-2.8 5.2 0",
    ],
    postcard: ["M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z", "M3.5 7.5 12 13.5l8.5-6"],
    gear: [
        "M12 6.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z",
        "M12 10.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Z",
        "M12 2v5M12 17v5M2 12h5M17 12h5M4.9 4.9l3.5 3.5M15.6 15.6l3.5 3.5M4.9 19.1l3.5-3.5M15.6 8.4l3.5-3.5",
    ],
    share: [
        "M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
        "M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
        "M18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
        "m8.6 10.5 6.8-4M8.6 13.5l6.8 4",
    ],
    play: ["M9 6.5 18 12 9 17.5V6.5Z"],
};

export default function Icon({ name, className }: { name: IconName; className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {PATHS[name].map((d) => (
                <path key={d} d={d} />
            ))}
        </svg>
    );
}
