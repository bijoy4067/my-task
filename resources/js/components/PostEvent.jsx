const MONTH = { month: "short" };
const DAY = { day: "numeric" };
const WHEN = { weekday: "short", hour: "numeric", minute: "2-digit" };

/**
 * An event reads as a date first, so the start date gets a calendar chip and the
 * rest of the detail sits beside it — rather than the raw toLocaleString() dump
 * the card used to print.
 */
export default function PostEvent({ event, title }) {
    if (!event?.starts_at) return null;

    const starts = new Date(event.starts_at);
    const ends = event.ends_at ? new Date(event.ends_at) : null;

    return (
        <div
            className="_mar_b16"
            style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: 16,
                borderRadius: 6,
                border: "1px solid rgba(0, 0, 0, 0.08)",
            }}
        >
            <div
                style={{
                    flex: "0 0 auto",
                    width: 56,
                    textAlign: "center",
                    borderRadius: 6,
                    overflow: "hidden",
                    border: "1px solid rgba(0, 0, 0, 0.08)",
                }}
            >
                <div
                    style={{
                        background: "var(--color5)",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        padding: "2px 0",
                    }}
                >
                    {starts.toLocaleDateString(undefined, MONTH)}
                </div>
                <div style={{ fontSize: 22, fontWeight: 600, padding: "4px 0" }}>
                    {starts.toLocaleDateString(undefined, DAY)}
                </div>
            </div>

            <div style={{ minWidth: 0 }}>
                {title && (
                    <h4 className="_feed_inner_timeline_post_title" style={{ margin: 0 }}>
                        {title}
                    </h4>
                )}
                <p className="_feed_inner_timeline_post_box_para" style={{ margin: "4px 0 0" }}>
                    {starts.toLocaleString(undefined, WHEN)}
                    {ends ? ` – ${ends.toLocaleString(undefined, WHEN)}` : ""}
                </p>
                {event.location && (
                    <p
                        className="_feed_inner_timeline_post_box_para"
                        style={{ margin: 0 }}
                    >
                        {event.location}
                    </p>
                )}
            </div>
        </div>
    );
}
