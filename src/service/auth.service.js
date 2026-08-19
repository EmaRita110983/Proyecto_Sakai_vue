import api from './api';

export async function funLogin(email, password) {
    const response = await api.post('/v1/auth/login', {
        email,
        password
    });

    return response.data;
}

export async function funPerfil() {
    const response = await api.get('/v1/auth/profile');

    return response.data;
}

export async function funLogout() {
    const response = await api.post('/v1/auth/logout');

    return response.data;
}

export async function funCambiarPassword(password, passwordConfirmation) {
    const response = await api.put('/v1/auth/change-password', {
        password,
        password_confirmation: passwordConfirmation
    });

    return response.data;
}

// ============================
// Funciones de autorización
// ============================

export function getUser() {
    const user = sessionStorage.getItem('user');

    return user ? JSON.parse(user) : null;
}

export function hasRole(role) {
    const user = getUser();

    if (!user) {
        return false;
    }

    return user.role === role;
}

export function isAuthenticated() {
    return !!sessionStorage.getItem('token');
}
