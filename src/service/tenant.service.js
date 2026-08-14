import api from './api';


// Branding efectivo del usuario logueado (para pintar el topbar).
export async function funObtenerBranding() {

    const response = await api.get('/v1/branding');

    return response.data;

}


// A partir de aquí: gestión del branding de un médico puntual, solo para el
// Superadmin, desde la pantalla de Usuarios.
export async function funObtenerBrandingUsuario(id) {

    const response = await api.get(`/v1/users/${id}/branding`);

    return response.data;

}


export async function funActualizarBrandingUsuario(id, branding) {

    const response = await api.put(`/v1/users/${id}/branding`, {
        brand_name: branding.brand_name,
        header_credentials: branding.header_credentials,
        licencia_declaracion: branding.licencia_declaracion
    });

    return response.data;

}


// El propio médico (admin) fija su color principal desde la paleta de
// colores de la app (AppConfigurator) — el Superadmin ya no lo hace por él.
export async function funActualizarColorPropio(color) {

    const response = await api.put('/v1/branding/color', { brand_color: color });

    return response.data;

}


export async function funSubirLogoUsuario(id, archivo) {

    const formData = new FormData();
    formData.append('logo', archivo);

    const response = await api.post(`/v1/users/${id}/branding/logo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });

    return response.data;

}


// lado: 'left' o 'right' — íconos en los extremos del header de los documentos.
export async function funSubirHeaderIconoUsuario(id, lado, archivo) {

    const formData = new FormData();
    formData.append('icon', archivo);

    const ruta = lado === 'left' ? 'header-icon-left' : 'header-icon-right';

    const response = await api.post(`/v1/users/${id}/branding/${ruta}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });

    return response.data;

}
