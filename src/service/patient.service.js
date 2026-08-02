import api from './api';


export async function funListarPacientes() {

    const response = await api.get('/v1/patients');

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