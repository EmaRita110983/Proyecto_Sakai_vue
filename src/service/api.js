import axios from 'axios';

// VITE_API_URL permite apuntar a un backend en otro host (ej. túnel de Cloudflare),
// donde el backend no vive en el mismo hostname:8000 que el frontend.
// El fallback a http://hostname:8000 solo aplica en desarrollo (import.meta.env.DEV):
// es cómodo para levantar el frontend en cualquier IP de la LAN sin configurar nada.
// En un build de producción (import.meta.env.PROD) NO hay fallback: si falta
// VITE_API_URL, antes la app caía en silencio a http:// sin cifrar contra el mismo
// host — ahora falla explícitamente para que el error se note en el despliegue, no
// en producción con datos médicos viajando sin TLS.
const baseURL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? `http://${window.location.hostname}:8000/api` : null);

if (!baseURL) {
    throw new Error('Falta configurar VITE_API_URL para este build de producción.');
}

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
