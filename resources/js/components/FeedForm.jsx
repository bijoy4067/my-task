import { useEffect, useRef, useState } from "react";
import { apiFetch, parseErrorMessage } from "../utils/ApiFetcher";

// `mode` is what the composer is showing (a plain status, an event, or an article).
// Attachments are kept independent of it, so an event or article can carry media too —
// the post's `type` is derived from both at submit time.
const EMPTY = {
    mode: "status",
    body: "",
    title: "",
    startsAt: "",
    endsAt: "",
    location: "",
    visibility: "public",
};

const MAX_IMAGES = 10;

// An ISO datetime from the API ("2026-07-20T18:30:00+00:00") and a <input type="datetime-local">
// value ("2026-07-20T18:30") agree on everything up to the seconds, and this app never
// converts between timezones elsewhere — so a straight slice round-trips cleanly.
const toDatetimeLocal = (iso) => (iso ? iso.slice(0, 16) : "");

// `post` puts the composer in edit mode: prefilled from an existing post, submitting
// updates it in place instead of creating a new one, and the type can no longer be changed.
export default function App({ onCreated, post, onSaved }) {
    const isEditing = Boolean(post);

    const initialForm = isEditing
        ? {
              mode: post.type,
              body: post.body || "",
              title: post.title || "",
              startsAt: toDatetimeLocal(post.event?.starts_at),
              endsAt: toDatetimeLocal(post.event?.ends_at),
              location: post.event?.location || "",
              visibility: post.visibility,
          }
        : EMPTY;

    const [form, setForm] = useState(initialForm);
    const [imageFiles, setImageFiles] = useState([]);
    const [videoFile, setVideoFile] = useState(null);
    const [previews, setPreviews] = useState([]);
    const [videoPreview, setVideoPreview] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    // Media the post already had. Existing images are removed by id (they're never
    // re-uploaded); the existing video is dropped wholesale since the collection holds one.
    const [existingImages, setExistingImages] = useState(isEditing ? post.images ?? [] : []);
    const [removedImageIds, setRemovedImageIds] = useState([]);
    const [existingVideoUrl, setExistingVideoUrl] = useState(isEditing ? post.video_url : null);
    const [videoRemoved, setVideoRemoved] = useState(false);

    const imageInput = useRef(null);
    const videoInput = useRef(null);

    // Object URLs leak until revoked, so tie each one's lifetime to the preview it backs.
    useEffect(() => {
        const urls = imageFiles.map((file) => URL.createObjectURL(file));
        setPreviews(urls);
        return () => urls.forEach(URL.revokeObjectURL);
    }, [imageFiles]);

    useEffect(() => {
        if (!videoFile) {
            setVideoPreview(null);
            return;
        }
        const url = URL.createObjectURL(videoFile);
        setVideoPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [videoFile]);

    const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));

    const reset = () => {
        setForm(EMPTY);
        setImageFiles([]);
        setVideoFile(null);
        setError(null);
        if (imageInput.current) imageInput.current.value = "";
        if (videoInput.current) videoInput.current.value = "";
    };

    const chooseType = (choice) => {
        setError(null);

        // Photo and Video open a picker without changing the mode, so media can be added
        // to an event or an article as well as to a plain post.
        if (choice === "photo") {
            imageInput.current?.click();
            return;
        }

        if (choice === "video") {
            videoInput.current?.click();
            return;
        }

        // Toggling the active mode off returns the composer to a plain status post.
        set("mode", form.mode === choice ? "status" : choice);
    };

    // Picking again adds to the selection rather than replacing it, so images can be
    // gathered a few at a time. Images and video stay mutually exclusive. Existing images
    // (edit mode) count against the same cap since they all end up on the same post.
    const addImages = (event) => {
        const picked = Array.from(event.target.files ?? []);
        event.target.value = "";
        if (picked.length === 0) return;

        setImageFiles((current) => {
            const room = MAX_IMAGES - existingImages.length;
            if (current.length + picked.length > room) {
                setError(`You can attach up to ${MAX_IMAGES} images.`);
            }
            return [...current, ...picked].slice(0, Math.max(room, 0));
        });
        setVideoFile(null);
    };

    const removeImage = (index) => {
        setImageFiles((current) => current.filter((_, at) => at !== index));
    };

    // Drops one of the post's already-uploaded images; the id is sent on save so the
    // server deletes it too.
    const removeExistingImage = (id) => {
        setExistingImages((current) => current.filter((image) => image.id !== id));
        setRemovedImageIds((current) => [...current, id]);
    };

    const removeVideo = () => {
        setVideoFile(null);
        if (videoInput.current) videoInput.current.value = "";
    };

    // Drops the post's already-uploaded video; flagged for the server to delete on save.
    const removeExistingVideo = () => {
        setExistingVideoUrl(null);
        setVideoRemoved(true);
    };

    // The stored type falls out of the mode plus whatever is attached. Fixed once a post
    // exists, since editing never changes what kind of post it is.
    const postType = () => {
        if (form.mode !== "status") return form.mode;
        if (imageFiles.length > 0) return "photo";
        if (videoFile) return "video";
        return "status";
    };

    const hasMedia =
        imageFiles.length > 0 ||
        Boolean(videoFile) ||
        existingImages.length > 0 ||
        Boolean(existingVideoUrl);

    const canSubmit = () => {
        if (submitting) return false;
        if (form.mode === "event") return Boolean(form.title.trim() && form.startsAt);
        if (form.mode === "article") return Boolean(form.title.trim() && form.body.trim());
        return hasMedia || form.body.trim().length > 0;
    };

    const submit = async () => {
        if (!canSubmit()) return;

        setSubmitting(true);
        setError(null);

        const payload = new FormData();
        payload.append("visibility", form.visibility);
        if (form.body) payload.append("body", form.body);
        if (form.title) payload.append("title", form.title);
        if (form.startsAt) payload.append("starts_at", form.startsAt);
        if (form.endsAt) payload.append("ends_at", form.endsAt);
        if (form.location) payload.append("location", form.location);
        imageFiles.forEach((file) => payload.append("images[]", file));
        if (videoFile) payload.append("video", videoFile);

        // Editing keeps the post's original type — it's never sent — and layers on the
        // media removals plus the PUT spoof (PHP won't populate $_FILES on a real PUT body).
        if (isEditing) {
            removedImageIds.forEach((id) => payload.append("remove_images[]", id));
            if (videoRemoved) payload.append("remove_video", "1");
            payload.append("_method", "PUT");
        } else {
            payload.append("type", postType());
        }

        try {
            const url = isEditing ? `/api/posts/${post.id}` : "/api/posts";
            const response = await apiFetch(url, { method: "POST", body: payload });

            if (!response.ok) {
                throw new Error(
                    await parseErrorMessage(
                        response,
                        isEditing ? "Unable to save changes." : "Unable to publish the post."
                    )
                );
            }

            const { data } = await response.json();

            if (isEditing) {
                onSaved?.(data);
            } else {
                onCreated?.(data);
                reset();
            }
        } catch (exception) {
            setError(exception.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Photo/Video light up when something is attached (new or already on the post);
    // Event/Article when that mode is on.
    const isActive = (choice) => {
        const active =
            choice === "photo"
                ? imageFiles.length > 0 || existingImages.length > 0
                : choice === "video"
                  ? Boolean(videoFile) || Boolean(existingVideoUrl)
                  : form.mode === choice;

        return active ? " _feed_reaction_active" : "";
    };

    return (
        <div className="_feed_inner_text_area  _b_radious6 _padd_b24 _padd_t24 _padd_r24 _padd_l24 _mar_b16">
            <div className="_feed_inner_text_area_box">
                <div className="_feed_inner_text_area_box_image">
                    <img
                        src="assets/images/txt_img.png"
                        alt="Image"
                        className="_txt_img"
                    />
                </div>
                <div className="form-floating _feed_inner_text_area_box_form ">
                    <textarea
                        className="form-control _textarea"
                        placeholder="Write something ..."
                        id="floatingTextarea"
                        value={form.body}
                        onChange={(event) => set("body", event.target.value)}
                    />
                    {/* This label is the visual placeholder. The stylesheet only hides it while
                        the textarea has focus, so once you clicked away it sat on top of the text
                        you had typed — it has to stay hidden whenever there is content. */}
                    <label
                        className="_feed_textarea_label"
                        htmlFor="floatingTextarea"
                        style={{
                            display: form.body ? "none" : "inline-flex",
                            alignItems: "center",
                            gap: 6,
                        }}
                    >
                        Write something ...
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width={23}
                            height={24}
                            fill="none"
                            viewBox="0 0 23 24"
                        >
                            <path
                                fill="#666"
                                d="M19.504 19.209c.332 0 .601.289.601.646 0 .326-.226.596-.52.64l-.081.005h-6.276c-.332 0-.602-.289-.602-.645 0-.327.227-.597.52-.64l.082-.006h6.276zM13.4 4.417c1.139-1.223 2.986-1.223 4.125 0l1.182 1.268c1.14 1.223 1.14 3.205 0 4.427L9.82 19.649a2.619 2.619 0 01-1.916.85h-3.64c-.337 0-.61-.298-.6-.66l.09-3.941a3.019 3.019 0 01.794-1.982l8.852-9.5zm-.688 2.562l-7.313 7.85a1.68 1.68 0 00-.441 1.101l-.077 3.278h3.023c.356 0 .698-.133.968-.376l.098-.096 7.35-7.887-3.608-3.87zm3.962-1.65a1.633 1.633 0 00-2.423 0l-.688.737 3.606 3.87.688-.737c.631-.678.666-1.755.105-2.477l-.105-.124-1.183-1.268z"
                            />
                        </svg>
                    </label>
                </div>
            </div>

            {/*Hidden pickers driven by the Photo / Video buttons below*/}
            <input
                ref={imageInput}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                multiple
                hidden
                onChange={addImages}
            />
            <input
                ref={videoInput}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                hidden
                onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setVideoFile(file);
                    setImageFiles([]);
                    set("type", file ? "video" : "status");
                }}
            />

            {/*Selected photos. The story card's dark scrim and caption bar belong to a story,
               not to an upload preview, so a tile here is just the image plus a corner remove
               control — and an add-more tile while there is room left. Existing (already
               uploaded) images and newly picked ones render side by side but remove through
               different handlers, since only the new ones are actual File objects.*/}
            {(existingImages.length > 0 || previews.length > 0) && (
                <div className="row _mar_b16">
                    {existingImages.map((image, index) => (
                        <div
                            key={`existing-${image.id}`}
                            className="col-xl-3 col-lg-3 col-md-4 col-sm-4 col _mar_b16"
                        >
                            <div style={{ position: "relative" }}>
                                <img
                                    src={image.url}
                                    alt={`Attached ${index + 1}`}
                                    style={{
                                        width: "100%",
                                        aspectRatio: "1 / 1",
                                        objectFit: "cover",
                                        borderRadius: 6,
                                        display: "block",
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => removeExistingImage(image.id)}
                                    aria-label={`Remove image ${index + 1}`}
                                    style={{
                                        position: "absolute",
                                        top: 6,
                                        right: 6,
                                        width: 24,
                                        height: 24,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        borderRadius: "50%",
                                        border: "none",
                                        background: "rgba(17, 32, 50, 0.75)",
                                        cursor: "pointer",
                                        padding: 0,
                                    }}
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width={10}
                                        height={10}
                                        fill="none"
                                        viewBox="0 0 10 10"
                                    >
                                        <path
                                            stroke="#fff"
                                            strokeLinecap="round"
                                            d="M1 1l8 8M9 1L1 9"
                                        />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}

                    {previews.map((url, index) => (
                        <div
                            key={url}
                            className="col-xl-3 col-lg-3 col-md-4 col-sm-4 col _mar_b16"
                        >
                            <div style={{ position: "relative" }}>
                                <img
                                    src={url}
                                    alt={`Selected ${index + 1}`}
                                    style={{
                                        width: "100%",
                                        aspectRatio: "1 / 1",
                                        objectFit: "cover",
                                        borderRadius: 6,
                                        display: "block",
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => removeImage(index)}
                                    aria-label={`Remove image ${index + 1}`}
                                    style={{
                                        position: "absolute",
                                        top: 6,
                                        right: 6,
                                        width: 24,
                                        height: 24,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        borderRadius: "50%",
                                        border: "none",
                                        background: "rgba(17, 32, 50, 0.75)",
                                        cursor: "pointer",
                                        padding: 0,
                                    }}
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width={10}
                                        height={10}
                                        fill="none"
                                        viewBox="0 0 10 10"
                                    >
                                        <path
                                            stroke="#fff"
                                            strokeLinecap="round"
                                            d="M1 1l8 8M9 1L1 9"
                                        />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}

                    {existingImages.length + previews.length < MAX_IMAGES && (
                        <div className="col-xl-3 col-lg-3 col-md-4 col-sm-4 col _mar_b16">
                            <button
                                type="button"
                                onClick={() => imageInput.current?.click()}
                                aria-label="Add more images"
                                style={{
                                    width: "100%",
                                    aspectRatio: "1 / 1",
                                    borderRadius: 6,
                                    border: "1px dashed #d5d5d5",
                                    background: "transparent",
                                    color: "#666",
                                    fontSize: 24,
                                    cursor: "pointer",
                                }}
                            >
                                +
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/*A raw <video> sizes itself to the file's intrinsic dimensions and blows out the
               composer, so it is boxed to a fixed 16:9 frame and letterboxed inside it. A newly
               picked file always wins over the existing video, since it's about to replace it.*/}
            {(videoPreview || existingVideoUrl) && (
                <div className="_mar_b16" style={{ position: "relative" }}>
                    <video
                        src={videoPreview || existingVideoUrl}
                        controls
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
                    <button
                        type="button"
                        onClick={videoPreview ? removeVideo : removeExistingVideo}
                        aria-label="Remove video"
                        style={{
                            position: "absolute",
                            top: 6,
                            right: 6,
                            width: 24,
                            height: 24,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: "50%",
                            border: "none",
                            background: "rgba(17, 32, 50, 0.75)",
                            cursor: "pointer",
                            padding: 0,
                        }}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width={10}
                            height={10}
                            fill="none"
                            viewBox="0 0 10 10"
                        >
                            <path stroke="#fff" strokeLinecap="round" d="M1 1l8 8M9 1L1 9" />
                        </svg>
                    </button>
                </div>
            )}

            {form.mode === "event" && (
                <div className="row _mar_b16">
                    <div className="col-12 _mar_b16">
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Event title"
                            value={form.title}
                            onChange={(event) => set("title", event.target.value)}
                        />
                    </div>
                    <div className="col-sm-6 _mar_b16">
                        <input
                            type="datetime-local"
                            className="form-control"
                            value={form.startsAt}
                            onChange={(event) => set("startsAt", event.target.value)}
                        />
                    </div>
                    <div className="col-sm-6 _mar_b16">
                        <input
                            type="datetime-local"
                            className="form-control"
                            value={form.endsAt}
                            onChange={(event) => set("endsAt", event.target.value)}
                        />
                    </div>
                    <div className="col-12">
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Location"
                            value={form.location}
                            onChange={(event) => set("location", event.target.value)}
                        />
                    </div>
                </div>
            )}

            {form.mode === "article" && (
                <div className="row _mar_b16">
                    <div className="col-12">
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Article title"
                            value={form.title}
                            onChange={(event) => set("title", event.target.value)}
                        />
                    </div>
                </div>
            )}

            {error && (
                <p className="_feed_inner_timeline_post_box_para" role="alert">
                    {error}
                </p>
            )}

            {/*For Desktop*/}
            <div className="_feed_inner_text_area_bottom">
                <div className="_feed_inner_text_area_item">
                    <div className={`_feed_inner_text_area_bottom_photo _feed_common${isActive("photo")}`}>
                        <button
                            type="button"
                            className="_feed_inner_text_area_bottom_photo_link"
                            onClick={() => chooseType("photo")}
                        >
                            {" "}
                            <span className="_feed_inner_text_area_bottom_photo_iamge _mar_img">
                                {" "}
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width={20}
                                    height={20}
                                    fill="none"
                                    viewBox="0 0 20 20"
                                >
                                    <path
                                        fill="#666"
                                        d="M13.916 0c3.109 0 5.18 2.429 5.18 5.914v8.17c0 3.486-2.072 5.916-5.18 5.916H5.999C2.89 20 .827 17.572.827 14.085v-8.17C.827 2.43 2.897 0 6 0h7.917zm0 1.504H5.999c-2.321 0-3.799 1.735-3.799 4.41v8.17c0 2.68 1.472 4.412 3.799 4.412h7.917c2.328 0 3.807-1.734 3.807-4.411v-8.17c0-2.678-1.478-4.411-3.807-4.411zm.65 8.68l.12.125 1.9 2.147a.803.803 0 01-.016 1.063.642.642 0 01-.894.058l-.076-.074-1.9-2.148a.806.806 0 00-1.205-.028l-.074.087-2.04 2.717c-.722.963-2.02 1.066-2.86.26l-.111-.116-.814-.91a.562.562 0 00-.793-.07l-.075.073-1.4 1.617a.645.645 0 01-.97.029.805.805 0 01-.09-.977l.064-.086 1.4-1.617c.736-.852 1.95-.897 2.734-.137l.114.12.81.905a.587.587 0 00.861.033l.07-.078 2.04-2.718c.81-1.08 2.27-1.19 3.205-.275zM6.831 4.64c1.265 0 2.292 1.125 2.292 2.51 0 1.386-1.027 2.511-2.292 2.511S4.54 8.537 4.54 7.152c0-1.386 1.026-2.51 2.291-2.51zm0 1.504c-.507 0-.918.451-.918 1.007 0 .555.411 1.006.918 1.006.507 0 .919-.451.919-1.006 0-.556-.412-1.007-.919-1.007z"
                                    />
                                </svg>
                            </span>
                            Photo
                        </button>
                    </div>
                    <div className={`_feed_inner_text_area_bottom_video _feed_common${isActive("video")}`}>
                        <button
                            type="button"
                            className="_feed_inner_text_area_bottom_photo_link"
                            onClick={() => chooseType("video")}
                        >
                            {" "}
                            <span className="_feed_inner_text_area_bottom_photo_iamge _mar_img">
                                {" "}
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width={22}
                                    height={24}
                                    fill="none"
                                    viewBox="0 0 22 24"
                                >
                                    <path
                                        fill="#666"
                                        d="M11.485 4.5c2.213 0 3.753 1.534 3.917 3.784l2.418-1.082c1.047-.468 2.188.327 2.271 1.533l.005.141v6.64c0 1.237-1.103 2.093-2.155 1.72l-.121-.047-2.418-1.083c-.164 2.25-1.708 3.785-3.917 3.785H5.76c-2.343 0-3.932-1.72-3.932-4.188V8.688c0-2.47 1.589-4.188 3.932-4.188h5.726zm0 1.5H5.76C4.169 6 3.197 7.05 3.197 8.688v7.015c0 1.636.972 2.688 2.562 2.688h5.726c1.586 0 2.562-1.054 2.562-2.688v-.686-6.329c0-1.636-.973-2.688-2.562-2.688zM18.4 8.57l-.062.02-2.921 1.306v4.596l2.921 1.307c.165.073.343-.036.38-.215l.008-.07V8.876c0-.195-.16-.334-.326-.305z"
                                    />
                                </svg>
                            </span>
                            Video
                        </button>
                    </div>
                    {/* A post's type is set for good at creation, so switching to Event or
                       Article mid-edit isn't offered — only Photo/Video (attaching media)
                       stay available above. */}
                    {!isEditing && (
                        <>
                            <div className={`_feed_inner_text_area_bottom_event _feed_common${isActive("event")}`}>
                                <button
                                    type="button"
                                    className="_feed_inner_text_area_bottom_photo_link"
                                    onClick={() => chooseType("event")}
                                >
                                    {" "}
                                    <span className="_feed_inner_text_area_bottom_photo_iamge _mar_img">
                                        {" "}
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width={22}
                                            height={24}
                                            fill="none"
                                            viewBox="0 0 22 24"
                                        >
                                            <path
                                                fill="#666"
                                                d="M14.371 2c.32 0 .585.262.627.603l.005.095v.788c2.598.195 4.188 2.033 4.18 5v8.488c0 3.145-1.786 5.026-4.656 5.026H7.395C4.53 22 2.74 20.087 2.74 16.904V8.486c0-2.966 1.596-4.804 4.187-5v-.788c0-.386.283-.698.633-.698.32 0 .584.262.626.603l.006.095v.771h5.546v-.771c0-.386.284-.698.633-.698zm3.546 8.283H4.004l.001 6.621c0 2.325 1.137 3.616 3.183 3.697l.207.004h7.132c2.184 0 3.39-1.271 3.39-3.63v-6.692zm-3.202 5.853c.349 0 .632.312.632.698 0 .353-.238.645-.546.691l-.086.006c-.357 0-.64-.312-.64-.697 0-.354.237-.645.546-.692l.094-.006zm-3.742 0c.35 0 .632.312.632.698 0 .353-.238.645-.546.691l-.086.006c-.357 0-.64-.312-.64-.697 0-.354.238-.645.546-.692l.094-.006zm-3.75 0c.35 0 .633.312.633.698 0 .353-.238.645-.547.691l-.093.006c-.35 0-.633-.312-.633-.697 0-.354.238-.645.547-.692l.094-.006zm7.492-3.615c.349 0 .632.312.632.697 0 .354-.238.645-.546.692l-.086.006c-.357 0-.64-.312-.64-.698 0-.353.237-.645.546-.691l.094-.006zm-3.742 0c.35 0 .632.312.632.697 0 .354-.238.645-.546.692l-.086.006c-.357 0-.64-.312-.64-.698 0-.353.238-.645.546-.691l.094-.006zm-3.75 0c.35 0 .633.312.633.697 0 .354-.238.645-.547.692l-.093.006c-.35 0-.633-.312-.633-.698 0-.353.238-.645.547-.691l.094-.006zm6.515-7.657H8.192v.895c0 .385-.283.698-.633.698-.32 0-.584-.263-.626-.603l-.006-.095v-.874c-1.886.173-2.922 1.422-2.922 3.6v.402h13.912v-.403c.007-2.181-1.024-3.427-2.914-3.599v.874c0 .385-.283.698-.632.698-.32 0-.585-.263-.627-.603l-.005-.095v-.895z"
                                            />
                                        </svg>
                                    </span>
                                    Event
                                </button>
                            </div>
                            <div className={`_feed_inner_text_area_bottom_article _feed_common${isActive("article")}`}>
                                <button
                                    type="button"
                                    className="_feed_inner_text_area_bottom_photo_link"
                                    onClick={() => chooseType("article")}
                                >
                                    {" "}
                                    <span className="_feed_inner_text_area_bottom_photo_iamge _mar_img">
                                        {" "}
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width={18}
                                            height={20}
                                            fill="none"
                                            viewBox="0 0 18 20"
                                        >
                                            <path
                                                fill="#666"
                                                d="M12.49 0c2.92 0 4.665 1.92 4.693 5.132v9.659c0 3.257-1.75 5.209-4.693 5.209H5.434c-.377 0-.734-.032-1.07-.095l-.2-.041C2 19.371.74 17.555.74 14.791V5.209c0-.334.019-.654.055-.96C1.114 1.564 2.799 0 5.434 0h7.056zm-.008 1.457H5.434c-2.244 0-3.381 1.263-3.381 3.752v9.582c0 2.489 1.137 3.752 3.38 3.752h7.049c2.242 0 3.372-1.263 3.372-3.752V5.209c0-2.489-1.13-3.752-3.372-3.752zm-.239 12.053c.36 0 .652.324.652.724 0 .4-.292.724-.652.724H5.656c-.36 0-.652-.324-.652-.724 0-.4.293-.724.652-.724h6.587zm0-4.239a.643.643 0 01.632.339.806.806 0 010 .78.643.643 0 01-.632.339H5.656c-.334-.042-.587-.355-.587-.729s.253-.688.587-.729h6.587zM8.17 5.042c.335.041.588.355.588.729 0 .373-.253.687-.588.728H5.665c-.336-.041-.589-.355-.589-.728 0-.374.253-.688.589-.729H8.17z"
                                            />
                                        </svg>
                                    </span>
                                    Article
                                </button>
                            </div>
                        </>
                    )}
                </div>
                <div
                    className="_feed_inner_text_area_btn"
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                    <select
                        className="form-select"
                        value={form.visibility}
                        onChange={(event) => set("visibility", event.target.value)}
                        aria-label="Post visibility"
                        style={{ width: "auto", fontSize: 14, padding: "6px 28px 6px 10px" }}
                    >
                        <option value="public">Public</option>
                        <option value="private">Private</option>
                    </select>
                    <button
                        type="button"
                        className="_feed_inner_text_area_btn_link"
                        onClick={submit}
                        disabled={!canSubmit()}
                    >
                        <svg
                            className="_mar_img"
                            xmlns="http://www.w3.org/2000/svg"
                            width={14}
                            height={13}
                            fill="none"
                            viewBox="0 0 14 13"
                        >
                            <path
                                fill="#fff"
                                fillRule="evenodd"
                                d="M6.37 7.879l2.438 3.955a.335.335 0 00.34.162c.068-.01.23-.05.289-.247l3.049-10.297a.348.348 0 00-.09-.35.341.341 0 00-.34-.088L1.75 4.03a.34.34 0 00-.247.289.343.343 0 00.16.347L5.666 7.17 9.2 3.597a.5.5 0 01.712.703L6.37 7.88zM9.097 13c-.464 0-.89-.236-1.14-.641L5.372 8.165l-4.237-2.65a1.336 1.336 0 01-.622-1.331c.074-.536.441-.96.957-1.112L11.774.054a1.347 1.347 0 011.67 1.682l-3.05 10.296A1.332 1.332 0 019.098 13z"
                                clipRule="evenodd"
                            />
                        </svg>{" "}
                        <span>
                            {submitting ? (isEditing ? "Saving..." : "Posting...") : isEditing ? "Save" : "Post"}
                        </span>
                    </button>
                </div>
            </div>
            {/*For Desktop*/}
            {/*For Mobile*/}
            <div className="_feed_inner_text_area_bottom_mobile">
                <div className="_feed_inner_text_mobile">
                    <div className="_feed_inner_text_area_item">
                        <div className={`_feed_inner_text_area_bottom_photo _feed_common${isActive("photo")}`}>
                            <button
                                type="button"
                                className="_feed_inner_text_area_bottom_photo_link"
                                onClick={() => chooseType("photo")}
                            >
                                {" "}
                                <span className="_feed_inner_text_area_bottom_photo_iamge _mar_img">
                                    {" "}
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width={20}
                                        height={20}
                                        fill="none"
                                        viewBox="0 0 20 20"
                                    >
                                        <path
                                            fill="#666"
                                            d="M13.916 0c3.109 0 5.18 2.429 5.18 5.914v8.17c0 3.486-2.072 5.916-5.18 5.916H5.999C2.89 20 .827 17.572.827 14.085v-8.17C.827 2.43 2.897 0 6 0h7.917zm0 1.504H5.999c-2.321 0-3.799 1.735-3.799 4.41v8.17c0 2.68 1.472 4.412 3.799 4.412h7.917c2.328 0 3.807-1.734 3.807-4.411v-8.17c0-2.678-1.478-4.411-3.807-4.411zm.65 8.68l.12.125 1.9 2.147a.803.803 0 01-.016 1.063.642.642 0 01-.894.058l-.076-.074-1.9-2.148a.806.806 0 00-1.205-.028l-.074.087-2.04 2.717c-.722.963-2.02 1.066-2.86.26l-.111-.116-.814-.91a.562.562 0 00-.793-.07l-.075.073-1.4 1.617a.645.645 0 01-.97.029.805.805 0 01-.09-.977l.064-.086 1.4-1.617c.736-.852 1.95-.897 2.734-.137l.114.12.81.905a.587.587 0 00.861.033l.07-.078 2.04-2.718c.81-1.08 2.27-1.19 3.205-.275zM6.831 4.64c1.265 0 2.292 1.125 2.292 2.51 0 1.386-1.027 2.511-2.292 2.511S4.54 8.537 4.54 7.152c0-1.386 1.026-2.51 2.291-2.51zm0 1.504c-.507 0-.918.451-.918 1.007 0 .555.411 1.006.918 1.006.507 0 .919-.451.919-1.006 0-.556-.412-1.007-.919-1.007z"
                                        />
                                    </svg>
                                </span>
                            </button>
                        </div>
                        <div className={`_feed_inner_text_area_bottom_video _feed_common${isActive("video")}`}>
                            <button
                                type="button"
                                className="_feed_inner_text_area_bottom_photo_link"
                                onClick={() => chooseType("video")}
                            >
                                <span className="_feed_inner_text_area_bottom_photo_iamge _mar_img">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width={22}
                                        height={24}
                                        fill="none"
                                        viewBox="0 0 22 24"
                                    >
                                        <path
                                            fill="#666"
                                            d="M11.485 4.5c2.213 0 3.753 1.534 3.917 3.784l2.418-1.082c1.047-.468 2.188.327 2.271 1.533l.005.141v6.64c0 1.237-1.103 2.093-2.155 1.72l-.121-.047-2.418-1.083c-.164 2.25-1.708 3.785-3.917 3.785H5.76c-2.343 0-3.932-1.72-3.932-4.188V8.688c0-2.47 1.589-4.188 3.932-4.188h5.726zm0 1.5H5.76C4.169 6 3.197 7.05 3.197 8.688v7.015c0 1.636.972 2.688 2.562 2.688h5.726c1.586 0 2.562-1.054 2.562-2.688v-.686-6.329c0-1.636-.973-2.688-2.562-2.688zM18.4 8.57l-.062.02-2.921 1.306v4.596l2.921 1.307c.165.073.343-.036.38-.215l.008-.07V8.876c0-.195-.16-.334-.326-.305z"
                                        />
                                    </svg>
                                </span>
                            </button>
                        </div>
                        {!isEditing && (
                            <>
                                <div className={`_feed_inner_text_area_bottom_event _feed_common${isActive("event")}`}>
                                    <button
                                        type="button"
                                        className="_feed_inner_text_area_bottom_photo_link"
                                        onClick={() => chooseType("event")}
                                    >
                                        <span className="_feed_inner_text_area_bottom_photo_iamge _mar_img">
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                width={22}
                                                height={24}
                                                fill="none"
                                                viewBox="0 0 22 24"
                                            >
                                                <path
                                                    fill="#666"
                                                    d="M14.371 2c.32 0 .585.262.627.603l.005.095v.788c2.598.195 4.188 2.033 4.18 5v8.488c0 3.145-1.786 5.026-4.656 5.026H7.395C4.53 22 2.74 20.087 2.74 16.904V8.486c0-2.966 1.596-4.804 4.187-5v-.788c0-.386.283-.698.633-.698.32 0 .584.262.626.603l.006.095v.771h5.546v-.771c0-.386.284-.698.633-.698zm3.546 8.283H4.004l.001 6.621c0 2.325 1.137 3.616 3.183 3.697l.207.004h7.132c2.184 0 3.39-1.271 3.39-3.63v-6.692zm-3.202 5.853c.349 0 .632.312.632.698 0 .353-.238.645-.546.691l-.086.006c-.357 0-.64-.312-.64-.697 0-.354.237-.645.546-.692l.094-.006zm-3.742 0c.35 0 .632.312.632.698 0 .353-.238.645-.546.691l-.086.006c-.357 0-.64-.312-.64-.697 0-.354.238-.645.546-.692l.094-.006zm-3.75 0c.35 0 .633.312.633.698 0 .353-.238.645-.547.691l-.093.006c-.35 0-.633-.312-.633-.697 0-.354.238-.645.547-.692l.094-.006zm7.492-3.615c.349 0 .632.312.632.697 0 .354-.238.645-.546.692l-.086.006c-.357 0-.64-.312-.64-.698 0-.353.237-.645.546-.691l.094-.006zm-3.742 0c.35 0 .632.312.632.697 0 .354-.238.645-.546.692l-.086.006c-.357 0-.64-.312-.64-.698 0-.353.238-.645.546-.691l.094-.006zm-3.75 0c.35 0 .633.312.633.697 0 .354-.238.645-.547.692l-.093.006c-.35 0-.633-.312-.633-.698 0-.353.238-.645.547-.691l.094-.006zm6.515-7.657H8.192v.895c0 .385-.283.698-.633.698-.32 0-.584-.263-.626-.603l-.006-.095v-.874c-1.886.173-2.922 1.422-2.922 3.6v.402h13.912v-.403c.007-2.181-1.024-3.427-2.914-3.599v.874c0 .385-.283.698-.632.698-.32 0-.585-.263-.627-.603l-.005-.095v-.895z"
                                                />
                                            </svg>
                                        </span>
                                    </button>
                                </div>
                                <div className={`_feed_inner_text_area_bottom_article _feed_common${isActive("article")}`}>
                                    <button
                                        type="button"
                                        className="_feed_inner_text_area_bottom_photo_link"
                                        onClick={() => chooseType("article")}
                                    >
                                        <span className="_feed_inner_text_area_bottom_photo_iamge _mar_img">
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                width={18}
                                                height={20}
                                                fill="none"
                                                viewBox="0 0 18 20"
                                            >
                                                <path
                                                    fill="#666"
                                                    d="M12.49 0c2.92 0 4.665 1.92 4.693 5.132v9.659c0 3.257-1.75 5.209-4.693 5.209H5.434c-.377 0-.734-.032-1.07-.095l-.2-.041C2 19.371.74 17.555.74 14.791V5.209c0-.334.019-.654.055-.96C1.114 1.564 2.799 0 5.434 0h7.056zm-.008 1.457H5.434c-2.244 0-3.381 1.263-3.381 3.752v9.582c0 2.489 1.137 3.752 3.38 3.752h7.049c2.242 0 3.372-1.263 3.372-3.752V5.209c0-2.489-1.13-3.752-3.372-3.752zm-.239 12.053c.36 0 .652.324.652.724 0 .4-.292.724-.652.724H5.656c-.36 0-.652-.324-.652-.724 0-.4.293-.724.652-.724h6.587zm0-4.239a.643.643 0 01.632.339.806.806 0 010 .78.643.643 0 01-.632.339H5.656c-.334-.042-.587-.355-.587-.729s.253-.688.587-.729h6.587zM8.17 5.042c.335.041.588.355.588.729 0 .373-.253.687-.588.728H5.665c-.336-.041-.589-.355-.589-.728 0-.374.253-.688.589-.729H8.17z"
                                                />
                                            </svg>
                                        </span>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                    <div
                        className="_feed_inner_text_area_btn"
                        style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                        <select
                            className="form-select"
                            value={form.visibility}
                            onChange={(event) => set("visibility", event.target.value)}
                            aria-label="Post visibility"
                            style={{ width: "auto", fontSize: 14, padding: "6px 24px 6px 8px" }}
                        >
                            <option value="public">Public</option>
                            <option value="private">Private</option>
                        </select>
                        <button
                            type="button"
                            className="_feed_inner_text_area_btn_link"
                            onClick={submit}
                            disabled={!canSubmit()}
                        >
                            <svg
                                className="_mar_img"
                                xmlns="http://www.w3.org/2000/svg"
                                width={14}
                                height={13}
                                fill="none"
                                viewBox="0 0 14 13"
                            >
                                <path
                                    fill="#fff"
                                    fillRule="evenodd"
                                    d="M6.37 7.879l2.438 3.955a.335.335 0 00.34.162c.068-.01.23-.05.289-.247l3.049-10.297a.348.348 0 00-.09-.35.341.341 0 00-.34-.088L1.75 4.03a.34.34 0 00-.247.289.343.343 0 00.16.347L5.666 7.17 9.2 3.597a.5.5 0 01.712.703L6.37 7.88zM9.097 13c-.464 0-.89-.236-1.14-.641L5.372 8.165l-4.237-2.65a1.336 1.336 0 01-.622-1.331c.074-.536.441-.96.957-1.112L11.774.054a1.347 1.347 0 011.67 1.682l-3.05 10.296A1.332 1.332 0 019.098 13z"
                                    clipRule="evenodd"
                                />
                            </svg>{" "}
                            <span>
                            {submitting ? (isEditing ? "Saving..." : "Posting...") : isEditing ? "Save" : "Post"}
                        </span>
                        </button>
                    </div>
                </div>
            </div>
            {/*For Mobile*/}
        </div>
    );
}
