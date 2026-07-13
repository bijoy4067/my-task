import { useState } from "react";

const CLAMP_AT = 280;

/**
 * Article bodies are long enough to swamp the feed, so anything past ~280 characters
 * is clamped behind a "See more". Plain text only — never dangerouslySetInnerHTML,
 * which would turn a post body into stored XSS.
 */
export default function PostBody({ body, clamp = false }) {
    const [expanded, setExpanded] = useState(false);

    if (!body) return null;

    const long = clamp && body.length > CLAMP_AT;
    const shown = long && !expanded ? `${body.slice(0, CLAMP_AT).trimEnd()}…` : body;

    return (
        <p
            className="_feed_inner_timeline_post_box_para"
            style={{ whiteSpace: "pre-wrap", marginBottom: 16 }}
        >
            {shown}
            {long && (
                <button
                    type="button"
                    className="_previous_comment_txt"
                    onClick={() => setExpanded((open) => !open)}
                    style={{ marginLeft: 6 }}
                >
                    {expanded ? "See less" : "See more"}
                </button>
            )}
        </p>
    );
}
