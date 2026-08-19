import api from './api';

export async function funListarDietas(patientId) {
    const response = await api.get('/v1/dietas', {
        params: patientId ? { patient_id: patientId } : {}
    });

    return response.data;
}

export async function funGuardarDieta(dieta) {
    const response = await api.post('/v1/dietas', dieta);

    return response.data;
}

export async function funActualizarDieta(id, dieta) {
    const response = await api.put(`/v1/dietas/${id}`, dieta);

    return response.data;
}

export async function funEliminarDieta(id) {
    const response = await api.delete(`/v1/dietas/${id}`);

    return response.data;
}
