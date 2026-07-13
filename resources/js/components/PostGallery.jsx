/**
 * Facebook-style collage: one image runs full width, two split, three put a tall
 * lead beside a stacked pair, and four-plus fill a 2x2 with a "+N" cap on the last
 * tile. Every tile is a fixed-ratio crop so a portrait screenshot can't stretch the
 * card the way a raw <img> grid does.
 */
export default function PostGallery({ images, onOpen }) {
    if (!images?.length) return null;

    const shown = images.slice(0, 4);
    const overflow = images.length - shown.length;

    const tile = (image, index, style = {}) => (
        <button
            key={image.id}
            type="button"
            onClick={() => onOpen?.(index)}
            style={{
                position: "relative",
                padding: 0,
                border: "none",
                background: "#000",
                cursor: "pointer",
                overflow: "hidden",
                ...style,
            }}
        >
            <img
                src={image.url}
                alt=""
                loading="lazy"
                style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                }}
            />
            {index === 3 && overflow > 0 && (
                <span
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(17, 32, 50, 0.6)",
                        color: "#fff",
                        fontSize: 28,
                        fontWeight: 600,
                    }}
                >
                    +{overflow}
                </span>
            )}
        </button>
    );

    const frame = {
        display: "grid",
        gap: 3,
        borderRadius: 6,
        overflow: "hidden",
    };

    if (shown.length === 1) {
        return (
            <div className="_feed_inner_timeline_image">
                <div style={frame}>
                    {tile(shown[0], 0, { maxHeight: 560, aspectRatio: "4 / 3" })}
                </div>
            </div>
        );
    }

    if (shown.length === 2) {
        return (
            <div className="_feed_inner_timeline_image">
                <div style={{ ...frame, gridTemplateColumns: "1fr 1fr", height: 320 }}>
                    {shown.map((image, index) => tile(image, index))}
                </div>
            </div>
        );
    }

    if (shown.length === 3) {
        return (
            <div className="_feed_inner_timeline_image">
                <div
                    style={{
                        ...frame,
                        gridTemplateColumns: "2fr 1fr",
                        gridTemplateRows: "1fr 1fr",
                        height: 360,
                    }}
                >
                    {tile(shown[0], 0, { gridRow: "span 2" })}
                    {tile(shown[1], 1)}
                    {tile(shown[2], 2)}
                </div>
            </div>
        );
    }

    return (
        <div className="_feed_inner_timeline_image">
            <div
                style={{
                    ...frame,
                    gridTemplateColumns: "1fr 1fr",
                    gridTemplateRows: "1fr 1fr",
                    height: 420,
                }}
            >
                {shown.map((image, index) => tile(image, index))}
            </div>
        </div>
    );
}
