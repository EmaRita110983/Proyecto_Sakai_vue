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