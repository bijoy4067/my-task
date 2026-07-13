function csrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content;
}

export async function apiFetch(url, { method = 'GET', body } = {}) {
    const response = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            ...(body ? { 'Content-Type': 'application/json' } : {}),
            ...(csrfToken() ? { 'X-CSRF-TOKEN': csrfToken() } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    return response;
}
