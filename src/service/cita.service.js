import api from './api';

export async function funListarCitas(filtros = {}) {
    const response = await api.get('/v1/citas', { params: filtros });

    return response.data;
}

export async function funGuardarCita(cita) {
    const response = await api.post('/v1/citas', cita);

    return response.data;
}

export async function funActualizarCita(id, cita) {
    const response = await api.put(`/v1/citas/${id}`, cita);

    return response.data;
}

export async function funEliminarCita(id) {
    const response = await api.delete(`/v1/citas/${id}`);

    return response.data;
}
