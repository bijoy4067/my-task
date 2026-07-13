import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../utils/ApiFetcher';

/**
 * Owns the feed list, its keyset cursor, and the mutations that act on it.
 * Like/comment/share will patch posts through `updatePost` without refetching.
 */
export function useFeed({ onUnauthorized } = {}) {
    const [posts, setPosts] = useState([]);
    const [cursor, setCursor] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Read inside loadMore without making it a dependency, so the callback stays stable
    // and the IntersectionObserver in PostList doesn't tear down on every page.
    const stateRef = useRef({ cursor: null, hasMore: true, loading: false });
    stateRef.current = { cursor, hasMore, loading };

    const loadMore = useCallback(async () => {
        const { cursor: at, hasMore: more, loading: busy } = stateRef.current;
        if (busy || !more) return;

        setLoading(true);
        setError(null);

        try {
            const query = at ? `?cursor=${at}` : '';
            const response = await apiFetch(`/api/feed${query}`);

            if (response.status === 401) {
                onUnauthorized?.();
                return;
            }

            if (!response.ok) {
                throw new Error('Unable to load the feed.');
            }

            const { data, meta } = await response.json();

            // Guard against a post arriving twice (e.g. it was optimistically prepended
            // after the page it belongs to was already fetched).
            setPosts((current) => {
                const seen = new Set(current.map((post) => post.id));
                return [...current, ...data.filter((post) => !seen.has(post.id))];
            });
            setCursor(meta.next_cursor);
            setHasMore(meta.next_cursor !== null);
        } catch (exception) {
            setError(exception.message);
        } finally {
            setLoading(false);
        }
    }, [onUnauthorized]);

    useEffect(() => {
        loadMore();
        // Intentionally runs once: loadMore is stable and pages itself on demand.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const prependPost = useCallback((post) => {
        setPosts((current) => [post, ...current]);
    }, []);

    const removePost = useCallback((id) => {
        setPosts((current) => current.filter((post) => post.id !== id));
    }, []);

    const updatePost = useCallback((id, patch) => {
        setPosts((current) =>
            current.map((post) => (post.id === id ? { ...post, ...patch } : post))
        );
    }, []);

    return { posts, loading, error, hasMore, loadMore, prependPost, removePost, updatePost };
}
