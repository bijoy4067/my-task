import { useCallback, useEffect, useRef, useState } from "react";

/**
 * An open/closed flag plus a ref to anchor it. Clicking anywhere outside the
 * anchored element (or pressing Escape) closes it, which is what every dropdown
 * in the header and the post cards needs.
 */
export function useDropdown() {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return;

        const onPointerDown = (event) => {
            if (!ref.current?.contains(event.target)) setOpen(false);
        };
        const onKeyDown = (event) => {
            if (event.key === "Escape") setOpen(false);
        };

        document.addEventListener("mousedown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);

        return () => {
            document.removeEventListener("mousedown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [open]);

    const toggle = useCallback(() => setOpen((current) => !current), []);
    const close = useCallback(() => setOpen(false), []);

    return { open, setOpen, toggle, close, ref };
}
