import api from './api';


export async function funListarAutorizaciones(patientId) {

    const response = await api.get('/v1/autorizaciones', {
        params: patientId ? { patient_id: patientId } : {}
    });

    return response.data;

}


export async function funGuardarAutorizacion(autorizacion) {

    const response = await api.post(
        '/v1/autorizaciones',
        autorizacion
    );

    return response.data;

}


export async function funActualizarAutorizacion(id, autorizacion) {

    const response = await api.put(
        `/v1/autorizaciones/${id}`,
        autorizacion
    );

    return response.data;

}


export async function funEliminarAutorizacion(id) {

    const response = await api.delete(`/v1/autorizaciones/${id}`);

    return response.data;

}
