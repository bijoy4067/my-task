const UNITS = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
    ["second", 1],
];

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

export function formatTimeAgo(iso) {
    const seconds = (new Date(iso).getTime() - Date.now()) / 1000;

    for (const [unit, size] of UNITS) {
        if (Math.abs(seconds) >= size || unit === "second") {
            return relative.format(Math.round(seconds / size), unit);
        }
    }

    return "";
}

const SHORT_UNITS = [
    ["y", 31536000],
    ["mo", 2592000],
    ["w", 604800],
    ["d", 86400],
    ["h", 3600],
    ["m", 60],
    ["s", 1],
];

/**
 * The compact form the comment action row uses — "21m" rather than "21 minutes ago". That row
 * is pinned under a bubble only as wide as its text, so a long timestamp has nowhere to go.
 */
export function formatTimeAgoShort(iso) {
    const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);

    for (const [suffix, size] of SHORT_UNITS) {
        if (seconds >= size || suffix === "s") {
            return `${Math.floor(seconds / size)}${suffix}`;
        }
    }

    return "";
}
