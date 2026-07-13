import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, parseErrorMessage } from "../utils/ApiFetcher";
import { formatTimeAgo } from "../utils/formatTimeAgo";
import { useDropdown } from "../hooks/useDropdown";
import { useLikeToggle } from "../hooks/useLikeToggle";
import LikersModal from "./LikersModal";
import PostBody from "./PostBody";
import PostEvent from "./PostEvent";
import PostGallery from "./PostGallery";

export default function PostCard({ post, onDeleted, onHidden, onUpdated }) {
    const navigate = useNavigate();
    const menu = useDropdown();
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState(null);
    const [showLikers, setShowLikers] = useState(false);

    // The card doesn't own the post — the feed does. Patches go back up to useFeed, which
    // re-renders this card with the new counts. No local copy to drift out of sync.
    const patchPost = useCallback(
        (patch) => onUpdated?.(post.id, patch),
        [onUpdated, post.id]
    );

    const like = useLikeToggle({
        liked: post.liked_by_me,
        count: post.likes_count,
        endpoint: `/api/posts/${post.id}/like`,
        onChange: patchPost,
    });

    const likers = post.likers_preview ?? [];

    const handleDelete = async () => {
        if (!window.confirm("Delete this post? This cannot be undone.")) return;

        setDeleting(true);
        setError(null);

        try {
            const response = await apiFetch(`/api/posts/${post.id}`, { method: "DELETE" });

            if (!response.ok) {
                throw new Error(await parseErrorMessage(response, "Unable to delete the post."));
            }

            onDeleted?.(post.id);
        } catch (exception) {
            setError(exception.message);
            setDeleting(false);
        }
    };

    return (
        <div className="_feed_inner_timeline_post_area _b_radious6 _padd_b24 _padd_t24 _mar_b16">
            <div className="_feed_inner_timeline_content _padd_r24 _padd_l24">
                <div className="_feed_inner_timeline_post_top">
                    <div className="_feed_inner_timeline_post_box">
                        <div className="_feed_inner_timeline_post_box_image">
                            <img
                                src={post.author.avatar_url || "assets/images/post_img.png"}
                                alt=""
                                className="_post_img"
                            />
                        </div>
                        <div className="_feed_inner_timeline_post_box_txt">
                            <h4 className="_feed_inner_timeline_post_box_title">
                                {post.author.name}
                            </h4>
                            <p className="_feed_inner_timeline_post_box_para">
                                {formatTimeAgo(post.created_at)} .
                                <a href="#0">
                                    {post.visibility === "private" ? "Private" : "Public"}
                                </a>
                            </p>
                        </div>
                    </div>
                    <div className="_feed_inner_timeline_post_box_dropdown" ref={menu.ref}>
                        <div className="_feed_timeline_post_dropdown">
                            <button
                                type="button"
                                className="_feed_timeline_post_dropdown_link"
                                onClick={menu.toggle}
                                aria-expanded={menu.open}
                                aria-label="Post options"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width={4}
                                    height={17}
                                    fill="none"
                                    viewBox="0 0 4 17"
                                >
                                    <circle cx={2} cy={2} r={2} fill="#C4C4C4" />
                                    <circle cx={2} cy={8} r={2} fill="#C4C4C4" />
                                    <circle cx={2} cy={15} r={2} fill="#C4C4C4" />
                                </svg>
                            </button>
                        </div>
                        {/*Dropdown. The stylesheet animates opacity/visibility and toggles on
                           `.show`, so this stays mounted rather than being conditionally rendered —
                           an inline `display: block` never beat `visibility: hidden`.*/}
                        <div
                            className={`_feed_timeline_dropdown _timeline_dropdown${
                                menu.open ? " show" : ""
                            }`}
                        >
                                <ul className="_feed_timeline_dropdown_list">
                                    {/* Only the post's own author can edit it — this mirrors
                                       the `delete` gate below and the same server-side check
                                       runs again on save, so hiding it here is a UX nicety,
                                       not the real access control. */}
                                    {post.permissions.update && (
                                        <li className="_feed_timeline_dropdown_item">
                                            <a
                                                href="#0"
                                                className="_feed_timeline_dropdown_link"
                                                onClick={(event) => {
                                                    event.preventDefault();
                                                    menu.close();
                                                    navigate(`/posts/${post.id}/edit`);
                                                }}
                                            >
                                                <span>
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
                                                            d="M11.25 3.75l3 3M2.25 15.75l1.084-3.935a1.5 1.5 0 01.386-.683l8.892-8.892a1.5 1.5 0 012.122 0l1.976 1.976a1.5 1.5 0 010 2.122l-8.892 8.892a1.5 1.5 0 01-.683.386L2.25 15.75z"
                                                        />
                                                    </svg>
                                                </span>
                                                Edit
                                            </a>
                                        </li>
                                    )}
                                    <li className="_feed_timeline_dropdown_item">
                                        <a
                                            href="#0"
                                            className="_feed_timeline_dropdown_link"
                                            onClick={(event) => {
                                                event.preventDefault();
                                                menu.close();
                                                navigator.clipboard?.writeText(
                                                    `${window.location.origin}/posts/${post.id}`
                                                );
                                            }}
                                        >
                                            <span>
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
                                                        d="M14.25 15.75L9 12l-5.25 3.75v-12a1.5 1.5 0 011.5-1.5h7.5a1.5 1.5 0 011.5 1.5v12z"
                                                    />
                                                </svg>
                                            </span>
                                            Copy Link
                                        </a>
                                    </li>
                                    <li className="_feed_timeline_dropdown_item">
                                        <a
                                            href="#0"
                                            className="_feed_timeline_dropdown_link"
                                            onClick={(event) => {
                                                event.preventDefault();
                                                menu.close();
                                                onHidden?.(post.id);
                                            }}
                                        >
                                            <span>
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
                                                        d="M14.25 2.25H3.75a1.5 1.5 0 00-1.5 1.5v10.5a1.5 1.5 0 001.5 1.5h10.5a1.5 1.5 0 001.5-1.5V3.75a1.5 1.5 0 00-1.5-1.5zM6.75 6.75l4.5 4.5M11.25 6.75l-4.5 4.5"
                                                    />
                                                </svg>
                                            </span>
                                            Hide
                                        </a>
                                    </li>
                                    {post.permissions.delete && (
                                        <li className="_feed_timeline_dropdown_item">
                                            <a
                                                href="#0"
                                                className="_feed_timeline_dropdown_link"
                                                onClick={(event) => {
                                                    event.preventDefault();
                                                    menu.close();
                                                    handleDelete();
                                                }}
                                            >
                                                <span>
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
                                                            d="M2.25 4.5h13.5M6 4.5V3a1.5 1.5 0 011.5-1.5h3A1.5 1.5 0 0112 3v1.5m2.25 0V15a1.5 1.5 0 01-1.5 1.5h-7.5a1.5 1.5 0 01-1.5-1.5V4.5h10.5zM7.5 8.25v4.5M10.5 8.25v4.5"
                                                        />
                                                    </svg>
                                                </span>
                                                {deleting ? "Deleting..." : "Delete Post"}
                                            </a>
                                        </li>
                                    )}
                                </ul>
                        </div>
                    </div>
                </div>

                {/* An event folds its title into the date card; everything else keeps the
                    template's title style. Article bodies get clamped behind "See more". */}
                {post.type === "event" ? (
                    <PostEvent event={post.event} title={post.title} />
                ) : (
                    post.title && (
                        <h4 className="_feed_inner_timeline_post_title">{post.title}</h4>
                    )
                )}

                <PostBody body={post.body} clamp={post.type === "article"} />

                <PostGallery images={post.images} />

                {/*`_time_img` is an image style — on a <video> it left the player looking like a
                   flat still, so the video gets its own letterboxed frame instead.*/}
                {post.video_url && (
                    <div className="_feed_inner_timeline_image">
                        <video
                            src={post.video_url}
                            controls
                            playsInline
                            preload="metadata"
                            style={{
                                width: "100%",
                                aspectRatio: "16 / 9",
                                objectFit: "contain",
                                background: "#000",
                                borderRadius: 6,
                                display: "block",
                            }}
                        />
                    </div>
                )}

                {error && (
                    <p className="_feed_inner_timeline_post_box_para" role="alert">
                        {error}
                    </p>
                )}
            </div>

            {/* The reactor avatars, then the count badge — which is styled to overlap them
                (margin-left: -16px), so it only renders once there are faces to sit on. The
                whole row opens the modal listing everyone who liked the post. */}
            <div className="_feed_inner_timeline_total_reacts _padd_r24 _padd_l24 _mar_b26">
                <div className="_feed_inner_timeline_total_reacts_image">
                    {post.likes_count > 0 && (
                        <button
                            type="button"
                            onClick={() => setShowLikers(true)}
                            aria-label={`See who reacted to this post (${post.likes_count})`}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                background: "none",
                                border: 0,
                                padding: 0,
                            }}
                        >
                            {/* The template gives the leading avatar its own class and hides
                                everything past the second on mobile, where the row won't fit. */}
                            {likers.map((liker, index) => (
                                <img
                                    key={liker.id}
                                    src={liker.avatar_url || "assets/images/react_img1.png"}
                                    alt={liker.name}
                                    title={liker.name}
                                    className={
                                        index === 0
                                            ? "_react_img1"
                                            : `_react_img${index >= 2 ? " _rect_img_mbl_none" : ""}`
                                    }
                                />
                            ))}
                            <p className="_feed_inner_timeline_total_reacts_para">
                                {post.likes_count}
                            </p>
                        </button>
                    )}
                </div>
                <div className="_feed_inner_timeline_total_reacts_txt">
                    <p className="_feed_inner_timeline_total_reacts_para1">
                        <a href="#0">
                            <span>{post.comments_count}</span> Comment
                        </a>
                    </p>
                </div>
            </div>

            {showLikers && (
                <LikersModal postId={post.id} onClose={() => setShowLikers(false)} />
            )}

            {like.error && (
                <p
                    className="_feed_inner_timeline_post_box_para _padd_r24 _padd_l24"
                    role="alert"
                >
                    {like.error}
                </p>
            )}

            {/* Reaction bar. Share stays inert for now — it has no backend behind it yet. */}
            <div className="_feed_inner_timeline_reaction">
                <button
                    type="button"
                    onClick={like.toggle}
                    aria-pressed={post.liked_by_me}
                    className={`_feed_inner_timeline_reaction_emoji _feed_reaction${
                        post.liked_by_me ? " _feed_reaction_active" : ""
                    }`}
                >
                    <span className="_feed_inner_timeline_reaction_link">
                        {" "}
                        <span>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width={19}
                                height={19}
                                fill="none"
                                viewBox="0 0 19 19"
                            >
                                <path
                                    fill="#FFCC4D"
                                    d="M9.5 19a9.5 9.5 0 100-19 9.5 9.5 0 000 19z"
                                />
                                <path
                                    fill="#664500"
                                    d="M9.5 11.083c-1.912 0-3.181-.222-4.75-.527-.358-.07-1.056 0-1.056 1.055 0 2.111 2.425 4.75 5.806 4.75 3.38 0 5.805-2.639 5.805-4.75 0-1.055-.697-1.125-1.055-1.055-1.57.305-2.838.527-4.75.527z"
                                />
                                <path
                                    fill="#fff"
                                    d="M4.75 11.611s1.583.528 4.75.528 4.75-.528 4.75-.528-1.056 2.111-4.75 2.111-4.75-2.11-4.75-2.11z"
                                />
                                <path
                                    fill="#664500"
                                    d="M6.333 8.972c.729 0 1.32-.827 1.32-1.847s-.591-1.847-1.32-1.847c-.729 0-1.32.827-1.32 1.847s.591 1.847 1.32 1.847zM12.667 8.972c.729 0 1.32-.827 1.32-1.847s-.591-1.847-1.32-1.847c-.729 0-1.32.827-1.32 1.847s.591 1.847 1.32 1.847z"
                                />
                            </svg>
                            Like
                        </span>
                    </span>
                </button>
                <button
                    type="button"
                    className="_feed_inner_timeline_reaction_comment _feed_reaction"
                >
                    <span className="_feed_inner_timeline_reaction_link">
                        {" "}
                        <span>
                            <svg
                                className="_reaction_svg"
                                xmlns="http://www.w3.org/2000/svg"
                                width={21}
                                height={21}
                                fill="none"
                                viewBox="0 0 21 21"
                            >
                                <path
                                    stroke="#000"
                                    d="M1 10.5c0-.464 0-.696.009-.893A9 9 0 019.607 1.01C9.804 1 10.036 1 10.5 1v0c.464 0 .696 0 .893.009a9 9 0 018.598 8.598c.009.197.009.429.009.893v6.046c0 1.36 0 2.041-.317 2.535a2 2 0 01-.602.602c-.494.317-1.174.317-2.535.317H10.5c-.464 0-.696 0-.893-.009a9 9 0 01-8.598-8.598C1 11.196 1 10.964 1 10.5v0z"
                                />
                                <path
                                    stroke="#000"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M6.938 9.313h7.125M10.5 14.063h3.563"
                                />
                            </svg>
                            Comment
                        </span>
                    </span>
                </button>
                <button
                    type="button"
                    className="_feed_inner_timeline_reaction_share _feed_reaction"
                >
                    <span className="_feed_inner_timeline_reaction_link">
                        {" "}
                        <span>
                            <svg
                                className="_reaction_svg"
                                xmlns="http://www.w3.org/2000/svg"
                                width={24}
                                height={21}
                                fill="none"
                                viewBox="0 0 24 21"
                            >
                                <path
                                    stroke="#000"
                                    strokeLinejoin="round"
                                    d="M23 10.5L12.917 1v5.429C3.267 6.429 1 13.258 1 20c2.785-3.52 5.248-5.429 11.917-5.429V20L23 10.5z"
                                />
                            </svg>
                            Share
                        </span>
                    </span>
                </button>
            </div>
        </div>
    );
}
