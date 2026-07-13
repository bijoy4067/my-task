import { useState } from "react";

/**
 * Facebook-style collage: one image runs full width, two split, three put a tall
 * lead beside a stacked pair, and four-plus fill a 2x2 with a "+N" cap on the last
 * tile. Every tile is a fixed-ratio crop so a portrait screenshot can't stretch the
 * card the way a raw <img> grid does.
 */
export default function PostGallery({ images, onOpen }) {
    // Which image the full-size preview modal is showing, or null when it's closed.
    // A tile click falls through to this by default; `onOpen` lets a caller override it.
    const [activeIndex, setActiveIndex] = useState(null);

    if (!images?.length) return null;

    const shown = images.slice(0, 4);
    const overflow = images.length - shown.length;
    const openPreview = onOpen ?? setActiveIndex;

    const tile = (image, index, style = {}) => (
        <button
            key={image.id}
            type="button"
            onClick={() => openPreview(index)}
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

    // One layout per count: a single full-width shot, an even split, a tall lead
    // beside a stacked pair, or a 2x2 (with the "+N" cap baked into the last tile).
    const grid =
        shown.length === 1 ? (
            <div className="_feed_inner_timeline_image">
                <div style={frame}>
                    {tile(shown[0], 0, { maxHeight: 560, aspectRatio: "4 / 3" })}
                </div>
            </div>
        ) : shown.length === 2 ? (
            <div className="_feed_inner_timeline_image">
                <div style={{ ...frame, gridTemplateColumns: "1fr 1fr", height: 320 }}>
                    {shown.map((image, index) => tile(image, index))}
                </div>
            </div>
        ) : shown.length === 3 ? (
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
        ) : (
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

    return (
        <>
            {grid}
            {/* Full-size preview modal, only used when nothing overrides `onOpen`. Backdrop
               click and the close button both dismiss it; the image itself stops the click
               from reaching the backdrop so tapping the photo doesn't close the preview. */}
            {activeIndex !== null && (
                <div
                    role="dialog"
                    aria-modal="true"
                    onClick={() => setActiveIndex(null)}
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0, 0, 0, 0.9)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1000,
                    }}
                >
                    <button
                        type="button"
                        onClick={() => setActiveIndex(null)}
                        aria-label="Close preview"
                        style={{
                            position: "absolute",
                            top: 16,
                            right: 16,
                            width: 36,
                            height: 36,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: "50%",
                            border: "none",
                            background: "rgba(255, 255, 255, 0.15)",
                            color: "#fff",
                            fontSize: 20,
                            cursor: "pointer",
                        }}
                    >
                        ×
                    </button>

                    {/* Prev/next only render when there is somewhere to go, so the arrows
                       don't sit there dead at either end of the set. */}
                    {activeIndex > 0 && (
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation();
                                setActiveIndex((index) => index - 1);
                            }}
                            aria-label="Previous image"
                            style={{
                                position: "absolute",
                                left: 16,
                                width: 40,
                                height: 40,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: "50%",
                                border: "none",
                                background: "rgba(255, 255, 255, 0.15)",
                                color: "#fff",
                                fontSize: 22,
                                cursor: "pointer",
                            }}
                        >
                            ‹
                        </button>
                    )}

                    <img
                        src={images[activeIndex].url}
                        alt=""
                        onClick={(event) => event.stopPropagation()}
                        style={{ maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain" }}
                    />

                    {activeIndex < images.length - 1 && (
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation();
                                setActiveIndex((index) => index + 1);
                            }}
                            aria-label="Next image"
                            style={{
                                position: "absolute",
                                right: 16,
                                width: 40,
                                height: 40,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: "50%",
                                border: "none",
                                background: "rgba(255, 255, 255, 0.15)",
                                color: "#fff",
                                fontSize: 22,
                                cursor: "pointer",
                            }}
                        >
                            ›
                        </button>
                    )}
                </div>
            )}
        </>
    );
}
