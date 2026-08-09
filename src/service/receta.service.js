import api from './api';


export async function funListarRecetas(patientId) {

    const response = await api.get('/v1/recetas', {
        params: patientId ? { patient_id: patientId } : {}
    });

    return response.data;

}


export async function funGuardarReceta(receta) {

    const response = await api.post(
        '/v1/recetas',
        receta
    );

    return response.data;

}


export async function funActualizarReceta(id, receta) {

    const response = await api.put(
        `/v1/recetas/${id}`,
        receta
    );

    return response.data;

}


export async function funEliminarReceta(id) {

    const response = await api.delete(`/v1/recetas/${id}`);

    return response.data;

}
