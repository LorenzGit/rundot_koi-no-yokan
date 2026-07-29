/**
 * Cast roster for KOI NO YOKAN.
 *
 * `heightCm` is the character's real-world standing height including footwear.
 *
 * `crownAdjustPx` nudges the automatically detected crown DOWN, in source-image
 * pixels, for art the detector cannot read on its own. The detector finds the
 * topmost wide, body-centred run, which correctly skips a raised arm but will
 * happily measure the top of a wide-brimmed hat as if it were the skull. No one
 * in the current cast wears one; set this if someone does.
 * Everything that places a sprite in a scene derives its pixel size from this
 * and a single scene-wide pixels-per-cm, so relative sizing can never drift
 * between locations or between the preview tool and the game.
 */
export const CAST = {
    char_f_artist: {
        name: "Mizuki",
        archetype: "night-owl artist",
        heightCm: 169, // barefoot
        crownAdjustPx: 0,
    },
    char_f_tsundere: {
        name: "Rin",
        archetype: "cheerful tsundere",
        heightCm: 171, // 164 plus heeled boots
        crownAdjustPx: 0,
    },
    char_m_senpai: {
        name: "Haruto",
        archetype: "cool senpai",
        heightCm: 184,
        crownAdjustPx: 0,
    },
    char_m_athlete: {
        name: "Sora",
        archetype: "sunny athlete",
        heightCm: 179,
        crownAdjustPx: 0,
    },
    char_f_siren: {
        name: "Reina",
        archetype: "sultry siren",
        heightCm: 174, // 167 plus heels
        crownAdjustPx: 0,
    },
    char_m_charmer: {
        name: "Kaito",
        archetype: "smouldering charmer",
        heightCm: 186,
        crownAdjustPx: 0,
    },
    char_f_runner: {
        name: "Kaede",
        archetype: "competitive runner",
        heightCm: 172,
        crownAdjustPx: 0,
    },
    char_m_climber: {
        name: "Ren",
        archetype: "grounded climber",
        heightCm: 181,
        crownAdjustPx: 0,
    },
};
