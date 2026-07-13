import { createContext, useContext, useEffect, useState } from 'react';
import { apiFetch } from '../utils/ApiFetcher';

const AutServiceProvider = createContext(null);

async function parseErrorMessage(response, fallback) {
    const data = await response.json().catch(() => ({}));
    if (data.errors) {
        return Object.values(data.errors).flat()[0] || fallback;
    }
    return data.message || fallback;
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiFetch('/api/user')
            .then((response) => (response.ok ? response.json() : null))
            .then((data) => setUser(data?.user ?? null))
            .finally(() => setLoading(false));
    }, []);

    const login = async ({ email, password, remember }) => {
        const response = await apiFetch('/api/login', {
            method: 'POST',
            body: { email, password, remember },
        });

        if (!response.ok) {
            throw new Error(await parseErrorMessage(response, 'Unable to log in.'));
        }

        const data = await response.json();
        setUser(data.user);
        return data.user;
    };

    const register = async ({ email, password, passwordConfirmation }) => {
        const response = await apiFetch('/api/register', {
            method: 'POST',
            body: {
                email,
                password,
                password_confirmation: passwordConfirmation,
            },
        });

        if (!response.ok) {
            throw new Error(await parseErrorMessage(response, 'Unable to register.'));
        }

        const data = await response.json();
        setUser(data.user);
        return data.user;
    };

    const logout = async () => {
        await apiFetch('/api/logout', { method: 'POST' });
        setUser(null);
    };

    return (
        <AutServiceProvider.Provider value={{ user, loading, login, register, logout, setUser }}>
            {children}
        </AutServiceProvider.Provider>
    );
}

export function useAuth() {
    const context = useContext(AutServiceProvider);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
