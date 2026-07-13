import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTheme } from "../../hooks/useTheme";
import { apiFetch, parseErrorMessage } from "../../utils/ApiFetcher";

import Header from "../../components/Header";
import LeftSideBar from "../../components/LeftSideBar";
import RightSideBar from "../../components/RightSideBar";
import FeedForm from "../../components/FeedForm";

export default function App() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { dark } = useTheme();

    const [post, setPost] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Loads the post being edited fresh on every visit — the feed's copy could be stale,
    // and a 403/404 here (someone else's post, or a deleted one) sends the user back.
    useEffect(() => {
        let ignore = false;

        apiFetch(`/api/posts/${id}`).then(async (response) => {
            if (ignore) return;

            if (!response.ok) {
                setError(await parseErrorMessage(response, "Unable to load this post."));
                setLoading(false);
                return;
            }

            const { data } = await response.json();
            setPost(data);
            setLoading(false);
        });

        return () => {
            ignore = true;
        };
    }, [id]);

    // Saving has nowhere else to go but back to the feed, where the refreshed list will
    // pick up the change on its own next load.
    const handleSaved = () => navigate("/");

    return (
        <div>
            <div className={`_layout _layout_main_wrapper${dark ? " _dark_wrapper" : ""}`}>
                <div className="_main_layout">
                    <Header />
                    <div className="container _custom_container">
                        <div className="_layout_inner_wrap">
                            <div className="row">
                                <LeftSideBar />

                                <div className="col-xl-6 col-lg-6 col-md-12 col-sm-12">
                                    <div className="_layout_middle_wrap">
                                        <div className="_layout_middle_inner">
                                            <button
                                                type="button"
                                                onClick={() => navigate("/")}
                                                style={{
                                                    background: "none",
                                                    border: "none",
                                                    padding: 0,
                                                    marginBottom: 16,
                                                    color: "#1890FF",
                                                    cursor: "pointer",
                                                }}
                                            >
                                                &larr; Back to feed
                                            </button>

                                            {loading && (
                                                <p className="_feed_inner_timeline_post_box_para">
                                                    Loading...
                                                </p>
                                            )}

                                            {error && (
                                                <p
                                                    className="_feed_inner_timeline_post_box_para"
                                                    role="alert"
                                                >
                                                    {error}
                                                </p>
                                            )}

                                            {post && <FeedForm post={post} onSaved={handleSaved} />}
                                        </div>
                                    </div>
                                </div>

                                <RightSideBar />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
