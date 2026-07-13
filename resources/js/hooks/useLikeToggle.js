import { useCallback, useRef, useState } from 'react';
import { apiFetch, parseErrorMessage } from '../utils/ApiFetcher';

/**
 * The like toggle behind both the post reaction bar and the per-comment like pill.
 *
 * The button repaints before the request leaves, then reconciles against whatever the server
 * says — so a like feels instant but the count on screen is never the client's guess for long.
 *
 * @param {object}   options
 * @param {boolean}  options.liked     Whether the viewer currently likes the thing.
 * @param {number}   options.count     Its current like count.
 * @param {string}   options.endpoint  The `/like` URL to POST (like) or DELETE (unlike).
 * @param {function} options.onChange  Applies a patch — optimistic, then the server's own state.
 */
export function useLikeToggle({ liked, count, endpoint, onChange }) {
    const [error, setError] = useState(null);

    // A ref, not state: a second click has to be turned away before React re-renders,
    // otherwise a fast double-tap fires two requests and the count ends up off by one.
    const inFlight = useRef(false);

    const toggle = useCallback(async () => {
        if (inFlight.current) return;
        inFlight.current = true;
        setError(null);

        const next = !liked;

        onChange({
            liked_by_me: next,
            likes_count: Math.max(0, count + (next ? 1 : -1)),
        });

        try {
            const response = await apiFetch(endpoint, { method: next ? 'POST' : 'DELETE' });

            if (!response.ok) {
                throw new Error(await parseErrorMessage(response, 'Unable to update your reaction.'));
            }

            // The server sends back likes_count, liked_by_me and (for a post) the refreshed
            // likers_preview — so the avatar row lands here rather than being guessed above.
            onChange(await response.json());
        } catch (exception) {
            onChange({ liked_by_me: liked, likes_count: count });
            setError(exception.message);
        } finally {
            inFlight.current = false;
        }
    }, [liked, count, endpoint, onChange]);

    return { toggle, error };
}
