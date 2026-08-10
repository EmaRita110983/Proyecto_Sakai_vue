import api from './api';


export async function funListarLicencias(patientId) {

    const response = await api.get('/v1/licencias', {
        params: patientId ? { patient_id: patientId } : {}
    });

    return response.data;

}


export async function funGuardarLicencia(licencia) {

    const response = await api.post(
        '/v1/licencias',
        licencia
    );

    return response.data;

}


export async function funActualizarLicencia(id, licencia) {

    const response = await api.put(
        `/v1/licencias/${id}`,
        licencia
    );

    return response.data;

}


export async function funEliminarLicencia(id) {

    const response = await api.delete(`/v1/licencias/${id}`);

    return response.data;

}
