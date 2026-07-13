import { useState } from "react";
import { apiFetch, parseErrorMessage } from "../utils/ApiFetcher";
import { useAuth } from "../services/AuthServiceProvider";

/**
 * The comment composer — the same box whether it is writing a top-level comment or a reply,
 * which is the only thing `parentId` changes.
 *
 * @param {number|null} parentId  The comment being replied to, or null for the post itself.
 */
export default function CommentBox({ postId, parentId = null, autoFocus = false, onCreated }) {
    const { user } = useAuth();
    const [body, setBody] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const submit = async (event) => {
        event.preventDefault();

        const trimmed = body.trim();
        if (!trimmed || saving) return;

        setSaving(true);
        setError(null);

        try {
            const response = await apiFetch(`/api/posts/${postId}/comments`, {
                method: "POST",
                body: { body: trimmed, parent_id: parentId },
            });

            if (!response.ok) {
                throw new Error(await parseErrorMessage(response, "Unable to post your comment."));
            }

            const { data } = await response.json();

            setBody("");
            onCreated?.(data);
        } catch (exception) {
            setError(exception.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="_feed_inner_comment_box">
            <form className="_feed_inner_comment_box_form" onSubmit={submit}>
                <div className="_feed_inner_comment_box_content">
                    <div className="_feed_inner_comment_box_content_image">
                        <img
                            src={user?.avatar_url || "assets/images/comment_img.png"}
                            alt=""
                            className="_comment_img"
                        />
                    </div>
                    <div className="_feed_inner_comment_box_content_txt">
                        {/* Enter sends, Shift+Enter breaks the line — the textarea is inside a
                            form, but a bare textarea never submits one on its own. */}
                        <textarea
                            className="form-control _comment_textarea"
                            placeholder={parentId ? "Write a reply" : "Write a comment"}
                            value={body}
                            autoFocus={autoFocus}
                            disabled={saving}
                            onChange={(event) => setBody(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" && !event.shiftKey) {
                                    event.preventDefault();
                                    submit(event);
                                }
                            }}
                        />
                    </div>
                </div>
                <div className="_feed_inner_comment_box_icon">
                    <button
                        type="submit"
                        className="_feed_inner_comment_box_icon_btn"
                        disabled={saving || !body.trim()}
                        aria-label={parentId ? "Post reply" : "Post comment"}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width={16}
                            height={16}
                            fill="none"
                            viewBox="0 0 24 24"
                        >
                            <path
                                stroke="#000"
                                strokeOpacity=".46"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
                            />
                        </svg>
                    </button>
                </div>
            </form>

            {error && (
                <p className="_feed_inner_timeline_post_box_para" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}
