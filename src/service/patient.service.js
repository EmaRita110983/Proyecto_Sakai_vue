import api from './api';


export async function funListarPacientes() {

    const response = await api.get('/v1/patients');

    return response.data;

}


export async function funObtenerPaciente(id) {

    const response = await api.get(`/v1/patients/${id}`);

    return response.data;

}


export async function funGuardarPaciente(paciente) {

    const response = await api.post(
        '/v1/patients',
        paciente
    );

    return response.data;

}


export async function funActualizarPaciente(id, paciente) {

    const response = await api.put(
        `/v1/patients/${id}`,
        paciente
    );

    return response.data;

}


export async function funEliminarPaciente(id) {

    const response = await api.delete(`/v1/patients/${id}`);

    return response.data;

}


// Busca un paciente eliminado (soft delete) por cédula o pasaporte, para
// consultar su ficha e historial de solo lectura aunque ya no aparezca en
// el listado normal.
export async function funBuscarPacienteEliminado(documento) {

    const response = await api.get('/v1/patients/eliminados/buscar', {
        params: { documento }
    });

    return response.data;

}