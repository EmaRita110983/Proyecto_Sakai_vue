import axios from 'axios';

// VITE_API_URL permite apuntar a un backend en otro host (ej. túnel de Cloudflare),
// donde el backend no vive en el mismo hostname:8000 que el frontend.
const baseURL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000/api`;

const api = axios.create({
    baseURL,
    headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
    }
});

// Interceptor para enviar automáticamente el token de Laravel Sanctum
api.interceptors.request.use(
    (config) => {
        const token = sessionStorage.getItem('token');

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        if (error.response && error.response.status === 401) {
            sessionStorage.removeItem('token');

            window.location.href = '/auth/login';
        }

        return Promise.reject(error);
    }
);

export default api;
