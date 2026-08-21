import api from './api';

export async function funListar() {
    const response = await api.get('/v1/users');

    return response.data;
}

// Conteos livianos para los tiles del Dashboard (médicos para superadmin,
// secretarias para admin) — a diferencia de funListar(), no trae el
// listado completo de usuarios solo para contarlos en el navegador.
export async function funObtenerEstadisticas() {
    const response = await api.get('/v1/users/stats/conteo');

    return response.data;
}

export async function funGuardar(usuario) {
    const response = await api.post('/v1/users', usuario);

    return response.data;
}

export async function funModificar(id, usuario) {
    const response = await api.put(`/v1/users/${id}`, usuario);

    return response.data;
}

export async function funCambiarEstado(id) {
    const response = await api.put(`/v1/users/${id}/status`);

    return response.data;
}

export async function funEliminar(id) {
    const response = await api.delete(`/v1/users/${id}`);

    return response.data;
}

// Busca un usuario (médico o secretaria) eliminado (soft delete) por cédula,
// para consultar sus datos de solo lectura aunque ya no aparezca en el
// listado normal.
export async function funBuscarUsuarioEliminado(documento) {
    const response = await api.get('/v1/users/eliminados/buscar', {
        params: { documento }
    });

    return response.data;
}

// Reactiva (deshace el soft delete) un usuario encontrado con
// funBuscarUsuarioEliminado.
export async function funReactivar(id) {
    const response = await api.put(`/v1/users/${id}/restore`);

    return response.data;
}

// Restablece manualmente la contraseña de un usuario que la olvidó (no hay
// flujo por email, ver UserController::resetPassword): genera una nueva
// contraseña aleatoria y obliga a cambiarla en el próximo login.
export async function funRestablecerPassword(id) {
    const response = await api.put(`/v1/users/${id}/reset-password`);

    return response.data;
}
