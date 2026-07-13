import { useCallback, useRef, useState } from 'react';
import { apiFetch, parseErrorMessage } from '../utils/ApiFetcher';

/**
 * Owns one post's thread — the same shape as useFeed, one level down.
 *
 * Replies live inside their parent rather than in a flat list, so every mutation has to be
 * able to reach either level. `patchComment` walks both, which keeps the components dumb:
 * they hand back an id and a patch and never care how deep the thing sits.
 */
export function useComments(postId) {
    const [comments, setComments] = useState([]);
    const [cursor, setCursor] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Read inside loadMore without being a dependency, so the callback stays stable.
    const stateRef = useRef({ cursor: null, hasMore: true, loading: false });
    stateRef.current = { cursor, hasMore, loading };

    // removeComment has to report how many comments it dropped. Deriving that inside the
    // setState updater would be wrong — React may run an updater more than once — so the
    // current thread is mirrored here and read directly.
    const commentsRef = useRef([]);
    commentsRef.current = comments;

    const loadMore = useCallback(async () => {
        const { cursor: at, hasMore: more, loading: busy } = stateRef.current;
        if (busy || !more) return;

        setLoading(true);
        setError(null);

        try {
            const query = at ? `?cursor=${at}` : '';
            const response = await apiFetch(`/api/posts/${postId}/comments${query}`);

            if (!response.ok) {
                throw new Error(await parseErrorMessage(response, 'Unable to load the comments.'));
            }

            const { data, meta } = await response.json();

            setComments((current) => {
                const seen = new Set(current.map((comment) => comment.id));
                return [...current, ...data.filter((comment) => !seen.has(comment.id))];
            });
            setCursor(meta.next_cursor);
            setHasMore(meta.next_cursor !== null);
        } catch (exception) {
            setError(exception.message);
        } finally {
            setLoading(false);
        }
    }, [postId]);

    /** A new top-level comment goes to the front; a reply goes onto its parent. */
    const addComment = useCallback((comment) => {
        setComments((current) => {
            if (comment.parent_id === null) {
                return [comment, ...current];
            }

            return current.map((parent) =>
                parent.id === comment.parent_id
                    ? {
                          ...parent,
                          replies: [...(parent.replies ?? []), comment],
                          replies_count: parent.replies_count + 1,
                      }
                    : parent
            );
        });
    }, []);

    const patchComment = useCallback((id, patch) => {
        setComments((current) =>
            current.map((comment) => {
                if (comment.id === id) {
                    return { ...comment, ...patch };
                }

                // Not this comment — it may still be one of its replies.
                const replies = comment.replies ?? [];
                if (!replies.some((reply) => reply.id === id)) {
                    return comment;
                }

                return {
                    ...comment,
                    replies: replies.map((reply) =>
                        reply.id === id ? { ...reply, ...patch } : reply
                    ),
                };
            })
        );
    }, []);

    /**
     * Removing a top-level comment takes its replies with it — the server cascades them, so
     * the count returned here is the whole subtree, which is what the post's "N Comment" has
     * to shed.
     *
     * @returns {number} how many comments left the thread.
     */
    const removeComment = useCallback((id) => {
        const parent = commentsRef.current.find((comment) => comment.id === id);
        const removed = parent ? 1 + (parent.replies?.length ?? 0) : 1;

        setComments((current) => {
            if (current.some((comment) => comment.id === id)) {
                return current.filter((comment) => comment.id !== id);
            }

            return current.map((comment) => {
                const replies = comment.replies ?? [];
                if (!replies.some((reply) => reply.id === id)) {
                    return comment;
                }

                return {
                    ...comment,
                    replies: replies.filter((reply) => reply.id !== id),
                    replies_count: Math.max(0, comment.replies_count - 1),
                };
            });
        });

        return removed;
    }, []);

    return {
        comments,
        loading,
        error,
        hasMore,
        loadMore,
        addComment,
        patchComment,
        removeComment,
    };
}
