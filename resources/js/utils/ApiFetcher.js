function csrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content;
}

export async function apiFetch(url, { method = 'GET', body } = {}) {
    // FormData must be sent raw so the browser can set its own multipart boundary.
    const isFormData = body instanceof FormData;

    const response = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            ...(body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
            ...(csrfToken() ? { 'X-CSRF-TOKEN': csrfToken() } : {}),
        },
        body: isFormData ? body : body ? JSON.stringify(body) : undefined,
    });

    return response;
}

export async function parseErrorMessage(response, fallback) {
    const data = await response.json().catch(() => ({}));
    if (data.errors) {
        return Object.values(data.errors).flat()[0] || fallback;
    }
    return data.message || fallback;
}
