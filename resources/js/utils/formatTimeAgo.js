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
