import api from './api';


export async function funListarHistorial(patientId) {

    const response = await api.get('/v1/historial', {
        params: patientId ? { patient_id: patientId } : {}
    });

    return response.data;

}


export async function funGuardarHistorial(entrada) {

    const response = await api.post(
        '/v1/historial',
        entrada
    );

    return response.data;

}


export async function funActualizarHistorial(id, entrada) {

    const response = await api.put(
        `/v1/historial/${id}`,
        entrada
    );

    return response.data;

}


export async function funEliminarHistorial(id) {

    const response = await api.delete(`/v1/historial/${id}`);

    return response.data;

}
