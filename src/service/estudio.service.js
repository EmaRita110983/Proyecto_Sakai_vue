import api from './api';

export async function funListarEstudios(patientId) {
    const response = await api.get('/v1/estudios', {
        params: patientId ? { patient_id: patientId } : {}
    });

    return response.data;
}

// datos: { patient_id, historial_medico_id, tipo, fecha_estudio, descripcion, archivo }
export async function funGuardarEstudio(datos) {
    const formData = new FormData();

    Object.entries(datos).forEach(([clave, valor]) => {
        if (valor !== null && valor !== undefined) {
            formData.append(clave, valor);
        }
    });

    const response = await api.post('/v1/estudios', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });

    return response.data;
}

// Solo metadatos (tipo, fecha_estudio, descripcion, historial_medico_id): para
// reemplazar el archivo se sube un estudio nuevo (ver EstudioMedicoController).
export async function funActualizarEstudio(id, datos) {
    const response = await api.put(`/v1/estudios/${id}`, datos);

    return response.data;
}

export async function funEliminarEstudio(id) {
    const response = await api.delete(`/v1/estudios/${id}`);

    return response.data;
}
