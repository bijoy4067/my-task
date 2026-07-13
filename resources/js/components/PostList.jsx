import { useEffect, useRef } from "react";
import PostCard from "./PostCard";

export default function PostList({ posts, loading, error, hasMore, loadMore, onDeleted }) {
    const sentinel = useRef(null);

    // Fetch the next page when the sentinel below the last card scrolls into view.
    // rootMargin starts the request before it's actually visible, so the list rarely
    // shows a gap while loading.
    useEffect(() => {
        const target = sentinel.current;
        if (!target || !hasMore) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) loadMore();
            },
            { rootMargin: "400px" }
        );

        observer.observe(target);
        return () => observer.disconnect();
    }, [hasMore, loadMore]);

    return (
        <>
            {posts.map((post) => (
                <PostCard
                    key={post.id}
                    post={post}
                    onDeleted={onDeleted}
                    onHidden={onDeleted}
                />
            ))}

            {error && (
                <div className="_feed_inner_timeline_post_area _b_radious6 _padd_b24 _padd_t24 _padd_r24 _padd_l24 _mar_b16">
                    <p className="_feed_inner_timeline_post_box_para" role="alert">
                        {error}
                    </p>
                    <button type="button" className="_previous_comment_txt" onClick={loadMore}>
                        Try again
                    </button>
                </div>
            )}

            {!loading && !error && posts.length === 0 && (
                <div className="_feed_inner_timeline_post_area _b_radious6 _padd_b24 _padd_t24 _padd_r24 _padd_l24 _mar_b16">
                    <p className="_feed_inner_timeline_post_box_para">
                        No posts yet. Write something to get started.
                    </p>
                </div>
            )}

            <div ref={sentinel} />

            {loading && (
                <div className="_feed_inner_timeline_post_area _b_radious6 _padd_b24 _padd_t24 _padd_r24 _padd_l24 _mar_b16">
                    <p className="_feed_inner_timeline_post_box_para">Loading posts...</p>
                </div>
            )}
        </>
    );
}
