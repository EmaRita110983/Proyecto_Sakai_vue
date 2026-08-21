import api from './api';

// Sin argumentos, exactamente el comportamiento de siempre (array completo
// del tenant). Con { page, per_page, q }, pagina de verdad en el backend
// (ver PatientController::index) — usado por Pacientes.vue, que antes
// traía el tenant completo y paginaba del lado del navegador (ver
// AUDITORIA.md, "Ningún listado pagina").
export async function funListarPacientes(params = {}) {
    const response = await api.get('/v1/patients', { params });

    return response.data;
}

// Búsqueda acotada (máx. 15) por nombre/cédula, para autocompletes como el
// de "Nueva cita" en el Dashboard — a diferencia de funListarPacientes(),
// no trae el listado completo del tenant.
export async function funBuscarPacientes(q) {
    const response = await api.get('/v1/patients', {
        params: { q }
    });

    return response.data;
}

export async function funObtenerPaciente(id) {
    const response = await api.get(`/v1/patients/${id}`);

    return response.data;
}

export async function funGuardarPaciente(paciente) {
    const response = await api.post('/v1/patients', paciente);

    return response.data;
}

export async function funActualizarPaciente(id, paciente) {
    const response = await api.put(`/v1/patients/${id}`, paciente);

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
