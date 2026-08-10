import api from './api';


export async function funListar() {

    const response = await api.get('/v1/users');

    return response.data;

}


export async function funGuardar(usuario) {

    const response = await api.post(
        '/v1/users',
        usuario
    );

    return response.data;

}


export async function funModificar(id, usuario) {

    const response = await api.put(
        `/v1/users/${id}`,
        usuario
    );

    return response.data;

}

export async function funCambiarEstado(id) {

    const response = await api.put(
        `/v1/users/${id}/status`
    );

    return response.data;

}


export async function funEliminar(id) {

    const response = await api.delete(
        `/v1/users/${id}`
    );

    return response.data;

}