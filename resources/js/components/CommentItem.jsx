import { useCallback, useState } from "react";
import { apiFetch, parseErrorMessage } from "../utils/ApiFetcher";
import { formatTimeAgoShort } from "../utils/formatTimeAgo";
import { useLikeToggle } from "../hooks/useLikeToggle";
import CommentBox from "./CommentBox";

/**
 * One comment: its body, the like pill, the Like/Reply row, and — for a top-level comment —
 * its replies underneath. The thread is one level deep, so a reply renders without a reply
 * box of its own; replying to it attaches to this parent instead.
 */
export default function CommentItem({
    postId,
    comment,
    isReply = false,
    onPatched,
    onRemoved,
    onReplyCreated,
}) {
    const [replying, setReplying] = useState(false);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(comment.body);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    const patch = useCallback(
        (fields) => onPatched(comment.id, fields),
        [onPatched, comment.id]
    );

    const like = useLikeToggle({
        liked: comment.liked_by_me,
        count: comment.likes_count,
        endpoint: `/api/comments/${comment.id}/like`,
        onChange: patch,
    });

    const saveEdit = async (event) => {
        event.preventDefault();

        const trimmed = draft.trim();
        if (!trimmed || busy) return;

        setBusy(true);
        setError(null);

        try {
            const response = await apiFetch(`/api/comments/${comment.id}`, {
                method: "PUT",
                body: { body: trimmed },
            });

            if (!response.ok) {
                throw new Error(await parseErrorMessage(response, "Unable to save your edit."));
            }

            const { data } = await response.json();

            patch({ body: data.body });
            setEditing(false);
        } catch (exception) {
            setError(exception.message);
        } finally {
            setBusy(false);
        }
    };

    const remove = async () => {
        if (busy || !window.confirm("Delete this comment?")) return;

        setBusy(true);
        setError(null);

        try {
            const response = await apiFetch(`/api/comments/${comment.id}`, { method: "DELETE" });

            if (!response.ok) {
                throw new Error(await parseErrorMessage(response, "Unable to delete the comment."));
            }

            onRemoved(comment.id);
        } catch (exception) {
            setError(exception.message);
            setBusy(false);
        }
    };

    return (
        <div className="_comment_main">
            <div className="_comment_image">
                <a href="#0" className="_comment_image_link">
                    <img
                        src={comment.author.avatar_url || "assets/images/txt_img.png"}
                        alt=""
                        className="_comment_img1"
                    />
                </a>
            </div>
            <div className="_comment_area">
                <div className="_comment_details">
                    <div className="_comment_details_top">
                        <div className="_comment_name">
                            <a href="#0">
                                <h4 className="_comment_name_title">{comment.author.name}</h4>
                            </a>
                        </div>
                    </div>

                    {editing ? (
                        <form onSubmit={saveEdit}>
                            <textarea
                                className="form-control _comment_textarea"
                                value={draft}
                                disabled={busy}
                                autoFocus
                                onChange={(event) => setDraft(event.target.value)}
                            />
                            <div className="_comment_reply_num">
                                <ul className="_comment_reply_list">
                                    <li>
                                        <button type="submit" disabled={busy || !draft.trim()}>
                                            <span>{busy ? "Saving..." : "Save"}</span>
                                        </button>
                                    </li>
                                    <li>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setDraft(comment.body);
                                                setEditing(false);
                                            }}
                                        >
                                            <span>Cancel</span>
                                        </button>
                                    </li>
                                </ul>
                            </div>
                        </form>
                    ) : (
                        <>
                            {comment.body && (
                                <div className="_comment_status">
                                    <p className="_comment_status_text">
                                        <span>{comment.body}</span>
                                    </p>
                                </div>
                            )}

                            {/* A comment can be nothing but a picture or a voice note, so the
                                attachments render whether or not there is any text above them. */}
                            {comment.images?.length > 0 && (
                                <div className="_comment_media">
                                    {comment.images.map((image) => (
                                        <a
                                            key={image.id}
                                            href={image.url}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            <img src={image.url} alt="" />
                                        </a>
                                    ))}
                                </div>
                            )}

                            {comment.audio_url && (
                                <audio
                                    className="_comment_audio"
                                    src={comment.audio_url}
                                    controls
                                    preload="metadata"
                                />
                            )}
                        </>
                    )}

                    {/* The template shows this pill only when there is something in it — an
                        empty reaction bubble hanging off every comment reads as a bug. */}
                    {comment.likes_count > 0 && (
                        <div className="_total_reactions">
                            <div className="_total_react">
                                <span className="_reaction_like">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width={16}
                                        height={16}
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="feather feather-thumbs-up"
                                    >
                                        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                                    </svg>
                                </span>
                            </div>
                            <span className="_total">{comment.likes_count}</span>
                        </div>
                    )}

                    <div className="_comment_reply">
                        <div className="_comment_reply_num">
                            <ul className="_comment_reply_list">
                                <li>
                                    <button
                                        type="button"
                                        onClick={like.toggle}
                                        aria-pressed={comment.liked_by_me}
                                    >
                                        <span
                                            style={{
                                                fontWeight: comment.liked_by_me ? 700 : undefined,
                                                color: comment.liked_by_me ? "#1890FF" : undefined,
                                            }}
                                        >
                                            Like.
                                        </span>
                                    </button>
                                </li>
                                {/* A reply cannot itself be replied to — the server rejects it,
                                    so the control isn't offered. Replying to a reply is done
                                    from its parent. */}
                                {!isReply && (
                                    <li>
                                        <button
                                            type="button"
                                            onClick={() => setReplying((open) => !open)}
                                        >
                                            <span>Reply.</span>
                                        </button>
                                    </li>
                                )}
                                {comment.permissions.update && (
                                    <li>
                                        <button type="button" onClick={() => setEditing(true)}>
                                            <span>Edit.</span>
                                        </button>
                                    </li>
                                )}
                                {comment.permissions.delete && (
                                    <li>
                                        <button type="button" onClick={remove} disabled={busy}>
                                            <span>Delete.</span>
                                        </button>
                                    </li>
                                )}
                                <li>
                                    <span className="_time_link">
                                        .{formatTimeAgoShort(comment.created_at)}
                                    </span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    {(error || like.error) && (
                        <p className="_feed_inner_timeline_post_box_para" role="alert">
                            {error || like.error}
                        </p>
                    )}
                </div>

                {comment.replies?.map((reply) => (
                    <CommentItem
                        key={reply.id}
                        postId={postId}
                        comment={reply}
                        isReply
                        onPatched={onPatched}
                        onRemoved={onRemoved}
                    />
                ))}

                {replying && (
                    <CommentBox
                        postId={postId}
                        parentId={comment.id}
                        autoFocus
                        onCreated={(created) => {
                            setReplying(false);
                            onReplyCreated(created);
                        }}
                    />
                )}
            </div>
        </div>
    );
}
