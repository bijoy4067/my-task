import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "theme";

/**
 * Dark mode is the `_dark_wrapper` class the stylesheet already keys ~250 rules off.
 * The choice is remembered so it survives a reload.
 */
export function useTheme() {
    const [dark, setDark] = useState(
        () => localStorage.getItem(STORAGE_KEY) === "dark"
    );

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
    }, [dark]);

    const toggle = useCallback(() => setDark((current) => !current), []);

    return { dark, toggle };
}
