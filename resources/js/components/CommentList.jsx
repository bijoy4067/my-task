import { useEffect } from "react";
import { useComments } from "../hooks/useComments";
import CommentBox from "./CommentBox";
import CommentItem from "./CommentItem";

/**
 * A post's thread: the composer, then the comments, with older ones paged in behind
 * "View previous comments".
 *
 * The post's own `comments_count` lives up in the feed, so every add and remove reports
 * back through `onCountChanged` — a reply counts toward the post's total just like a
 * top-level comment, and deleting a parent takes its whole subtree out of it.
 */
export default function CommentList({ postId, commentsCount = 0, onCountChanged }) {
    const {
        comments,
        loading,
        error,
        hasMore,
        loadMore,
        addComment,
        patchComment,
        removeComment,
    } = useComments(postId);

    // Every card shows its composer, so this mounts for every post in the feed — but a post
    // with no comments has nothing to fetch, and asking anyway would put an empty request
    // behind each one of them.
    useEffect(() => {
        if (commentsCount > 0) loadMore();
        // Intentionally runs once, on mount.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleCreated = (comment) => {
        addComment(comment);
        onCountChanged(1);
    };

    const handleRemoved = (id) => {
        onCountChanged(-removeComment(id));
    };

    return (
        <div className="_feed_inner_timeline_cooment_area">
            <CommentBox postId={postId} onCreated={handleCreated} />

            <div className="_timline_comment_main">
                {hasMore && !loading && comments.length > 0 && (
                    <div className="_previous_comment">
                        <button
                            type="button"
                            className="_previous_comment_txt"
                            onClick={loadMore}
                        >
                            View previous comments
                        </button>
                    </div>
                )}

                {comments.map((comment) => (
                    <CommentItem
                        key={comment.id}
                        postId={postId}
                        comment={comment}
                        onPatched={patchComment}
                        onRemoved={handleRemoved}
                        onReplyCreated={handleCreated}
                    />
                ))}

                {loading && (
                    <p className="_feed_inner_timeline_post_box_para">Loading comments...</p>
                )}

                {error && (
                    <p className="_feed_inner_timeline_post_box_para" role="alert">
                        {error}
                    </p>
                )}

                {!loading && !error && comments.length === 0 && (
                    <p className="_feed_inner_timeline_post_box_para">
                        No comments yet. Be the first.
                    </p>
                )}
            </div>
        </div>
    );
}
