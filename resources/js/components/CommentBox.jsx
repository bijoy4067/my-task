import { useEffect, useRef, useState } from "react";
import { apiFetch, parseErrorMessage } from "../utils/ApiFetcher";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { useAuth } from "../services/AuthServiceProvider";

const MAX_IMAGES = 4;

/** mm:ss, for the recording timer. */
function clock(seconds) {
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * The comment composer — the same box whether it is writing a top-level comment or a reply,
 * which is the only thing `parentId` changes.
 *
 * The template's two icons are a microphone and an image. Both are live: the mic records a
 * voice note, the image button attaches pictures, and anything attached is previewed here
 * before it is sent.
 *
 * @param {number|null} parentId  The comment being replied to, or null for the post itself.
 */
export default function CommentBox({ postId, parentId = null, autoFocus = false, onCreated }) {
    const { user } = useAuth();
    const recorder = useAudioRecorder();

    const [body, setBody] = useState("");
    const [images, setImages] = useState([]);
    const [voiceNote, setVoiceNote] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const filePicker = useRef(null);

    // Previews are object URLs into the user's own files. The browser holds the blob alive
    // until the URL is revoked, so each one is released when its attachment goes away.
    const [previews, setPreviews] = useState([]);

    useEffect(() => {
        const urls = images.map((image) => URL.createObjectURL(image));
        setPreviews(urls);

        return () => urls.forEach(URL.revokeObjectURL);
    }, [images]);

    const [voiceUrl, setVoiceUrl] = useState(null);

    useEffect(() => {
        if (!voiceNote) {
            setVoiceUrl(null);
            return;
        }

        const url = URL.createObjectURL(voiceNote);
        setVoiceUrl(url);

        return () => URL.revokeObjectURL(url);
    }, [voiceNote]);

    const addImages = (event) => {
        const picked = Array.from(event.target.files ?? []);

        setError(null);
        setImages((current) => {
            if (current.length + picked.length > MAX_IMAGES) {
                setError(`A comment can carry at most ${MAX_IMAGES} images.`);
                return current;
            }

            return [...current, ...picked];
        });

        // Reset the input, or picking the same file twice in a row is a no-op — the value
        // has not changed, so `change` never fires again.
        event.target.value = "";
    };

    const toggleRecording = async () => {
        if (recorder.recording) {
            const clip = await recorder.stop();
            if (clip) setVoiceNote(clip);
            return;
        }

        recorder.start();
    };

    const hasAttachment = images.length > 0 || voiceNote !== null;

    const submit = async (event) => {
        event.preventDefault();

        const trimmed = body.trim();

        // A picture or a voice note stands on its own; only a wholly empty comment is refused.
        if ((!trimmed && !hasAttachment) || saving || recorder.recording) return;

        setSaving(true);
        setError(null);

        try {
            // Files can only go up as multipart, so an attachment forces FormData. A plain
            // text comment stays JSON, which is what the endpoint saw before any of this.
            let payload;

            if (hasAttachment) {
                payload = new FormData();
                if (trimmed) payload.append("body", trimmed);
                if (parentId) payload.append("parent_id", parentId);
                images.forEach((image) => payload.append("images[]", image));
                if (voiceNote) payload.append("audio", voiceNote);
            } else {
                payload = { body: trimmed, parent_id: parentId };
            }

            const response = await apiFetch(`/api/posts/${postId}/comments`, {
                method: "POST",
                body: payload,
            });

            if (!response.ok) {
                throw new Error(await parseErrorMessage(response, "Unable to post your comment."));
            }

            const { data } = await response.json();

            setBody("");
            setImages([]);
            setVoiceNote(null);
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
                        {recorder.recording ? (
                            // The textarea gives way to the timer while recording — there is
                            // nothing to type, and the state needs to be unmistakable.
                            <div className="_comment_recording">
                                <span className="_comment_recording_dot" />
                                Recording {clock(recorder.seconds)}
                            </div>
                        ) : (
                            /* Enter sends, Shift+Enter breaks the line — a bare textarea in a
                               form never submits on its own. */
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
                        )}
                    </div>
                </div>

                <div className="_feed_inner_comment_box_icon">
                    {recorder.supported && (
                        <button
                            type="button"
                            className={`_feed_inner_comment_box_icon_btn${
                                recorder.recording ? " _is_recording" : ""
                            }`}
                            onClick={toggleRecording}
                            disabled={saving || (voiceNote !== null && !recorder.recording)}
                            title={recorder.recording ? "Stop recording" : "Record a voice note"}
                            aria-label={recorder.recording ? "Stop recording" : "Record a voice note"}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width={16}
                                height={16}
                                fill="none"
                                viewBox="0 0 16 16"
                            >
                                <path
                                    fill="#000"
                                    fillOpacity=".46"
                                    fillRule="evenodd"
                                    d="M13.167 6.534a.5.5 0 01.5.5c0 3.061-2.35 5.582-5.333 5.837V14.5a.5.5 0 01-1 0v-1.629C4.35 12.616 2 10.096 2 7.034a.5.5 0 011 0c0 2.679 2.168 4.859 4.833 4.859 2.666 0 4.834-2.18 4.834-4.86a.5.5 0 01.5-.5zM7.833.667a3.218 3.218 0 013.208 3.22v3.126c0 1.775-1.439 3.22-3.208 3.22a3.218 3.218 0 01-3.208-3.22V3.887c0-1.776 1.44-3.22 3.208-3.22zm0 1a2.217 2.217 0 00-2.208 2.22v3.126c0 1.223.991 2.22 2.208 2.22a2.217 2.217 0 002.208-2.22V3.887c0-1.224-.99-2.22-2.208-2.22z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        </button>
                    )}

                    <button
                        type="button"
                        className="_feed_inner_comment_box_icon_btn"
                        onClick={() => filePicker.current?.click()}
                        disabled={saving || recorder.recording || images.length >= MAX_IMAGES}
                        title="Attach an image"
                        aria-label="Attach an image"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width={16}
                            height={16}
                            fill="none"
                            viewBox="0 0 16 16"
                        >
                            <path
                                fill="#000"
                                fillOpacity=".46"
                                fillRule="evenodd"
                                d="M10.867 1.333c2.257 0 3.774 1.581 3.774 3.933v5.435c0 2.352-1.517 3.932-3.774 3.932H5.101c-2.254 0-3.767-1.58-3.767-3.932V5.266c0-2.352 1.513-3.933 3.767-3.933h5.766zm0 1H5.101c-1.681 0-2.767 1.152-2.767 2.933v5.435c0 1.782 1.086 2.932 2.767 2.932h5.766c1.685 0 2.774-1.15 2.774-2.932V5.266c0-1.781-1.089-2.933-2.774-2.933zm.426 5.733l.017.015.013.013.009.008.037.037c.12.12.453.46 1.443 1.477a.5.5 0 11-.716.697S10.73 8.91 10.633 8.816a.614.614 0 00-.433-.118.622.622 0 00-.421.225c-1.55 1.88-1.568 1.897-1.594 1.922a1.456 1.456 0 01-2.057-.021s-.62-.63-.63-.642c-.155-.143-.43-.134-.594.04l-1.02 1.076a.498.498 0 01-.707.018.499.499 0 01-.018-.706l1.018-1.075c.54-.573 1.45-.6 2.025-.06l.639.647c.178.18.467.184.646.008l1.519-1.843a1.618 1.618 0 011.098-.584c.433-.038.854.088 1.19.363zM5.706 4.42c.921 0 1.67.75 1.67 1.67 0 .92-.75 1.67-1.67 1.67-.92 0-1.67-.75-1.67-1.67 0-.921.75-1.67 1.67-1.67zm0 1a.67.67 0 10.001 1.34.67.67 0 00-.002-1.34z"
                                clipRule="evenodd"
                            />
                        </svg>
                    </button>

                    <button
                        type="submit"
                        className="_feed_inner_comment_box_icon_btn"
                        disabled={saving || recorder.recording || (!body.trim() && !hasAttachment)}
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

                    <input
                        ref={filePicker}
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        multiple
                        hidden
                        onChange={addImages}
                    />
                </div>
            </form>

            {/* The preview strip: what is attached, and how to take it back off again. */}
            {(previews.length > 0 || voiceUrl) && (
                <div className="_comment_attachments">
                    {previews.map((url, index) => (
                        <div className="_comment_attachment" key={url}>
                            <img src={url} alt={images[index]?.name ?? ""} />
                            <button
                                type="button"
                                className="_comment_attachment_remove"
                                onClick={() =>
                                    setImages((current) =>
                                        current.filter((_, at) => at !== index)
                                    )
                                }
                                aria-label="Remove image"
                            >
                                ×
                            </button>
                        </div>
                    ))}

                    {voiceUrl && (
                        <div className="_comment_attachment _comment_attachment_audio">
                            <audio src={voiceUrl} controls preload="metadata" />
                            <button
                                type="button"
                                className="_comment_attachment_remove"
                                onClick={() => setVoiceNote(null)}
                                aria-label="Discard voice note"
                            >
                                ×
                            </button>
                        </div>
                    )}
                </div>
            )}

            {(error || recorder.error) && (
                <p className="_feed_inner_timeline_post_box_para" role="alert">
                    {error || recorder.error}
                </p>
            )}
        </div>
    );
}
