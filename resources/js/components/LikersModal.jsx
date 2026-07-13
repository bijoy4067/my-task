import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, parseErrorMessage } from "../utils/ApiFetcher";

/**
 * Everyone who liked a post — opened by clicking the reactor avatar row on the card.
 * The card only shows the first five faces, so this is the only way to see the rest.
 */
export default function LikersModal({ postId, onClose }) {
    const [likers, setLikers] = useState([]);
    const [cursor, setCursor] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Mirrors useFeed: the cursor is read inside the loader without being a dependency,
    // so the callback stays stable and the initial effect can't re-fire itself.
    const stateRef = useRef({ cursor: null, hasMore: true, loading: false });
    stateRef.current = { cursor, hasMore, loading };

    const loadMore = useCallback(async () => {
        const { cursor: at, hasMore: more, loading: busy } = stateRef.current;
        if (busy || !more) return;

        setLoading(true);
        setError(null);

        try {
            const query = at ? `?cursor=${at}` : "";
            const response = await apiFetch(`/api/posts/${postId}/likes${query}`);

            if (!response.ok) {
                throw new Error(await parseErrorMessage(response, "Unable to load the reactions."));
            }

            const { data, meta } = await response.json();

            setLikers((current) => [...current, ...data]);
            setCursor(meta.next_cursor);
            setHasMore(meta.next_cursor !== null);
        } catch (exception) {
            setError(exception.message);
        } finally {
            setLoading(false);
        }
    }, [postId]);

    useEffect(() => {
        loadMore();
        // Intentionally runs once; further pages are pulled by the button below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Escape closes, matching the dropdown behaviour in useDropdown.
    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.key === "Escape") onClose();
        };

        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [onClose]);

    return (
        <div
            className="_feed_inner_timeline_reactions_modal"
            role="dialog"
            aria-modal="true"
            aria-label="People who reacted"
            onClick={onClose}
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 1050,
                background: "rgba(0, 0, 0, 0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
            }}
        >
            {/* The backdrop closes on click, so the panel has to stop clicks of its own
                from bubbling up into it. */}
            <div
                className="_feed_inner_timeline_post_area _b_radious6 _padd_b24 _padd_t24"
                onClick={(event) => event.stopPropagation()}
                style={{
                    width: "100%",
                    maxWidth: 420,
                    maxHeight: "80vh",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                <div className="_feed_inner_timeline_post_top _padd_r24 _padd_l24 _mar_b26">
                    <h4 className="_feed_inner_timeline_post_box_title">Reactions</h4>
                    <button
                        type="button"
                        className="_feed_timeline_post_dropdown_link"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width={18}
                            height={18}
                            fill="none"
                            viewBox="0 0 18 18"
                        >
                            <path
                                stroke="#1890FF"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="1.2"
                                d="M13.5 4.5l-9 9M4.5 4.5l9 9"
                            />
                        </svg>
                    </button>
                </div>

                <div className="_padd_r24 _padd_l24" style={{ overflowY: "auto" }}>
                    {likers.map((liker) => (
                        <div className="_comment_main _mar_b16" key={liker.id}>
                            <div className="_comment_image">
                                <img
                                    src={liker.avatar_url || "assets/images/txt_img.png"}
                                    alt=""
                                    className="_comment_img1"
                                />
                            </div>
                            <div className="_comment_area">
                                <h4 className="_comment_name_title">{liker.name}</h4>
                            </div>
                        </div>
                    ))}

                    {error && (
                        <p className="_feed_inner_timeline_post_box_para" role="alert">
                            {error}
                        </p>
                    )}

                    {!loading && !error && likers.length === 0 && (
                        <p className="_feed_inner_timeline_post_box_para">
                            No reactions yet.
                        </p>
                    )}

                    {loading && (
                        <p className="_feed_inner_timeline_post_box_para">Loading...</p>
                    )}

                    {hasMore && !loading && (
                        <button
                            type="button"
                            className="_previous_comment_txt"
                            onClick={loadMore}
                        >
                            View more
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
