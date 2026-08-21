<script setup>
import { onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getUser } from '@/service/auth.service';
import { funBuscarPacientes, funGuardarPaciente } from '@/service/patient.service';
import { funObtenerEstadisticas } from '@/service/usuario.service';
import { funListarCitas, funGuardarCita, funActualizarCita } from '@/service/cita.service';
import { useToast } from 'primevue/usetoast';

const route = useRoute();
const router = useRouter();
const usuario = getUser();
const toast = useToast();

const totalPacientes = ref(null);
const totalSecretarias = ref(null);
const totalMedicos = ref(null);

const puedeVerUsuarios = usuario?.role === 'admin' || usuario?.role === 'superadmin';
// El conteo de médicos solo tiene sentido para el superadmin: un admin es un
// único médico (tenant), no gestiona otros médicos.
const puedeVerMedicos = usuario?.role === 'superadmin';
const puedeVerCitas = usuario?.role === 'admin' || usuario?.role === 'secretaria';
// El superadmin no gestiona pacientes ni secretarias de ningún tenant en
// particular, así que su Dashboard no muestra esos conteos, solo el de
// médicos (puedeVerMedicos arriba).
const puedeVerSecretarias = usuario?.role === 'admin';

const hoy = new Date();
const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

// ============ Citas de hoy ============
const citasHoy = ref([]);
const pacientes = ref([]);
const errores = ref({});
const visibleCitaDialog = ref(false);

const citaVacia = {
    hora: null,
    motivo: ''
};

const cita = ref({ ...citaVacia });

// Autocompletado de paciente: si se selecciona una sugerencia, este ref queda
// con el objeto paciente completo; si el usuario solo escribe texto (sin
// seleccionar), queda como string y, al guardar, se abre el formulario
// completo de "Nuevo Paciente" (mismo que en Pacientes.vue) para registrarlo.
const pacienteInput = ref('');
const sugerenciasPacientes = ref([]);

// ============ Paciente nuevo (mismo formulario que Pacientes.vue) ============
const visibleNuevoPacienteDialog = ref(false);
const erroresPaciente = ref({});

const pacienteVacio = {
    first_name: '',
    last_name: '',
    cedula: '',
    pasaporte: '',
    birth_date: null,
    phone: '',
    email: '',
    address: '',
    insurance: '',
    emergency_contact: '',
    emergency_phone: '',
    medical_conditions: ''
};

const pacienteNuevo = ref({ ...pacienteVacio });

const formatearFecha = (fecha) => {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
};

const formatearHora = (fecha) => {
    const horas = String(fecha.getHours()).padStart(2, '0');
    const minutos = String(fecha.getMinutes()).padStart(2, '0');
    return `${horas}:${minutos}`;
};

const cargarCitasHoy = async () => {
    citasHoy.value = await funListarCitas({ fecha: hoyStr, estado: 'pendiente' });
};

const marcarComoAtendida = async (citaSeleccionada) => {
    try {
        await funActualizarCita(citaSeleccionada.id, {
            fecha: hoyStr,
            hora: citaSeleccionada.hora,
            motivo: citaSeleccionada.motivo,
            estado: 'completada'
        });

        toast.add({ severity: 'success', summary: 'Cita atendida', detail: 'Se marcó como completada', life: 3000 });

        // Al filtrar por estado=pendiente, la cita atendida desaparece de esta lista.
        await cargarCitasHoy();
    } catch (error) {
        console.error(error);

        toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.message ?? 'Ocurrió un error inesperado', life: 3000 });
    }
};

const nuevaCita = () => {
    errores.value = {};
    cita.value = { ...citaVacia };
    pacienteInput.value = '';
    visibleCitaDialog.value = true;
};

// Búsqueda server-side (funBuscarPacientes, máx. 15 resultados) en vez de
// filtrar un listado completo precargado — ver PatientController::index.
const buscarSugerenciasPacientes = async (event) => {
    const query = event.query.trim();

    if (!query) {
        sugerenciasPacientes.value = [];
        return;
    }

    try {
        const resultados = await funBuscarPacientes(query);
        sugerenciasPacientes.value = resultados.map((p) => ({ ...p, nombreCompleto: `${p.first_name} ${p.last_name}${p.cedula ? ' — CI ' + p.cedula : ''}` }));
    } catch (error) {
        console.error(error);
        sugerenciasPacientes.value = [];
    }
};

const crearCitaConPaciente = async (patientId) => {
    await funGuardarCita({
        patient_id: patientId,
        fecha: hoyStr,
        hora: cita.value.hora ? formatearHora(cita.value.hora) : null,
        motivo: cita.value.motivo
    });

    toast.add({ severity: 'success', summary: 'Cita creada', detail: 'La cita fue agendada correctamente', life: 3000 });

    visibleCitaDialog.value = false;
    await cargarCitasHoy();
};

const guardarCita = async () => {
    try {
        if (pacienteInput.value && typeof pacienteInput.value === 'object') {
            // Paciente existente, elegido de las sugerencias.
            await crearCitaConPaciente(pacienteInput.value.id);
            return;
        }

        if (typeof pacienteInput.value === 'string' && pacienteInput.value.trim()) {
            // No coincide con ningún paciente existente: se completa su registro
            // con el mismo formulario de "Nuevo Paciente" antes de agendar.
            const partes = pacienteInput.value.trim().split(/\s+/);

            erroresPaciente.value = {};
            pacienteNuevo.value = {
                ...pacienteVacio,
                first_name: partes[0] ?? '',
                last_name: partes.slice(1).join(' ')
            };
            visibleNuevoPacienteDialog.value = true;
            return;
        }

        toast.add({ severity: 'warn', summary: 'Falta el paciente', detail: 'Escribe el nombre del paciente', life: 3000 });
    } catch (error) {
        console.error(error);

        if (error.response?.status === 422) {
            errores.value = error.response.data.errors ?? {};
        }

        toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.message ?? 'Ocurrió un error inesperado', life: 3000 });
    }
};

const guardarNuevoPacienteYCita = async () => {
    try {
        const datosEnviar = {
            ...pacienteNuevo.value,
            birth_date: pacienteNuevo.value.birth_date ? formatearFecha(pacienteNuevo.value.birth_date) : null
        };

        const { patient: nuevoPaciente } = await funGuardarPaciente(datosEnviar);

        pacientes.value.push(nuevoPaciente);
        totalPacientes.value = pacientes.value.length;

        toast.add({ severity: 'success', summary: 'Paciente creado', detail: 'El paciente fue registrado correctamente', life: 3000 });

        visibleNuevoPacienteDialog.value = false;
        await crearCitaConPaciente(nuevoPaciente.id);
    } catch (error) {
        console.error(error);

        if (error.response?.status === 422) {
            erroresPaciente.value = error.response.data.errors ?? {};

            toast.add({ severity: 'warn', summary: 'Datos inválidos', detail: 'Revisa los campos marcados', life: 3000 });
            return;
        }

        toast.add({ severity: 'error', summary: 'Error', detail: error.response?.data?.message ?? 'Ocurrió un error inesperado', life: 3000 });
    }
};

// Acceso directo desde el sidebar ("Nueva cita"): abre el diálogo y limpia
// el query para que un refresh no lo vuelva a abrir. Si ya estabas en el
// Dashboard, Vue Router no remonta el componente (misma ruta '/', solo
// cambia el query), así que además de llamarla en onMounted hace falta un
// watch sobre el query para que también funcione en ese caso.
const abrirNuevaCitaDesdeQuery = () => {
    if (route.query.accion === 'nueva-cita' && puedeVerCitas) {
        nuevaCita();
        router.replace({ path: '/' });
    }
};

watch(() => route.query.accion, abrirNuevaCitaDesdeQuery);

onMounted(async () => {
    if (puedeVerUsuarios) {
        try {
            const stats = await funObtenerEstadisticas();
            totalSecretarias.value = stats.secretarias ?? totalSecretarias.value;
            totalMedicos.value = stats.medicos ?? totalMedicos.value;
        } catch (error) {
            console.error(error);
        }
    }

    if (puedeVerCitas) {
        try {
            await cargarCitasHoy();
        } catch (error) {
            console.error(error);
        }
    }

    abrirNuevaCitaDesdeQuery();
});
</script>

<template>
    <div>
        <Toast />
        <div class="card mb-4">
            <h2 class="m-0 font-display">Hola, {{ usuario?.name }}</h2>
            <small class="text-surface-500">Resumen de tu cuenta.</small>
        </div>

        <div class="grid grid-cols-12 gap-4 mb-4">
            <div v-if="usuario?.role !== 'superadmin'" class="col-span-12 md:col-span-6 xl:col-span-4">
                <div v-if="puedeVerCitas" class="card stat-tile">
                    <div class="stat-icon"><i class="pi pi-calendar"></i></div>
                    <div>
                        <span class="stat-label">Citas de hoy</span>
                        <span class="stat-num">{{ citasHoy.length }}</span>
                    </div>
                </div>

                <div v-else class="card stat-tile">
                    <div class="stat-icon"><i class="pi pi-id-card"></i></div>
                    <div>
                        <span class="stat-label">Pacientes</span>
                        <span class="stat-num">{{ totalPacientes ?? '—' }}</span>
                    </div>
                </div>
            </div>

            <div v-if="puedeVerMedicos" class="col-span-12 md:col-span-6 xl:col-span-4">
                <div class="card stat-tile">
                    <div class="stat-icon"><i class="pi pi-user"></i></div>
                    <div>
                        <span class="stat-label">Médicos</span>
                        <span class="stat-num">{{ totalMedicos ?? '—' }}</span>
                    </div>
                </div>
            </div>

            <div v-if="puedeVerSecretarias" class="col-span-12 md:col-span-6 xl:col-span-4">
                <div class="card stat-tile">
                    <div class="stat-icon"><i class="pi pi-users"></i></div>
                    <div>
                        <span class="stat-label">Secretarias</span>
                        <span class="stat-num">{{ totalSecretarias ?? '—' }}</span>
                    </div>
                </div>
            </div>
        </div>

        <div v-if="puedeVerCitas" class="card mb-4">
            <div class="flex justify-between items-center mb-3">
                <h3 class="m-0 font-display" style="font-size: 1.05rem">Citas pendientes de hoy</h3>
                <Button class="btn-nueva-cita" label="Nueva cita" icon="pi pi-calendar-plus" @click="nuevaCita()" />
            </div>

            <DataTable :value="citasHoy" stripedRows showGridlines size="small">
                <Column field="hora" header="Hora" bodyClass="text-tabular"></Column>
                <Column header="Paciente">
                    <template #body="slotProps"> {{ slotProps.data.patient?.first_name }} {{ slotProps.data.patient?.last_name }} </template>
                </Column>
                <Column field="motivo" header="Motivo"></Column>
                <Column v-if="usuario?.role !== 'secretaria'" header="Acciones">
                    <template #body="slotProps">
                        <Button icon="pi pi-check" severity="success" rounded label="Atendido" @click="marcarComoAtendida(slotProps.data)" />
                    </template>
                </Column>
                <template #empty>No hay citas pendientes para hoy.</template>
            </DataTable>
        </div>

        <div v-if="usuario?.role !== 'secretaria'" class="card">
            <h3 class="mt-0 mb-3 font-display" style="font-size: 1.05rem">Accesos rápidos</h3>
            <div class="flex flex-wrap gap-2">
                <Button v-if="usuario?.role === 'admin'" label="Ver pacientes" icon="pi pi-id-card" severity="secondary" @click="router.push('/pacientes')" />
                <Button v-if="usuario?.role === 'admin'" label="Historial clínico" icon="pi pi-book" severity="secondary" @click="router.push('/historial')" />
                <Button v-if="usuario?.role === 'superadmin'" label="Ver usuarios" icon="pi pi-users" severity="secondary" @click="router.push('/usuarios')" />
            </div>
        </div>

        <Dialog v-model:visible="visibleCitaDialog" header="Nueva cita" :modal="true" :style="{ width: '450px' }" :breakpoints="{ '576px': '90vw' }">
            <div class="flex flex-col gap-3 pt-2">
                <div class="flex items-center gap-2">
                    <FloatLabel class="w-full">
                        <AutoComplete id="patient_id" v-model="pacienteInput" :suggestions="sugerenciasPacientes" optionLabel="nombreCompleto" :delay="300" dropdown class="w-full" inputClass="w-full" @complete="buscarSugerenciasPacientes" />
                        <label for="patient_id">Paciente</label>
                    </FloatLabel>
                    <i class="pi pi-info-circle text-surface-500" v-tooltip.top="'Si el paciente no aparece en las sugerencias, se registrará como nuevo (escribe nombre y apellido).'"></i>
                </div>
                <small v-if="errores.patient_id" class="text-red-500">{{ errores.patient_id[0] }}</small>

                <FloatLabel class="w-full">
                    <DatePicker id="hora" v-model="cita.hora" timeOnly hourFormat="12" showIcon iconDisplay="input" class="w-full" />
                    <label for="hora">Hora</label>
                </FloatLabel>
                <small v-if="errores.hora" class="text-red-500">{{ errores.hora[0] }}</small>

                <FloatLabel class="w-full">
                    <Textarea id="motivo" v-model="cita.motivo" class="w-full" rows="2" autoResize />
                    <label for="motivo">Síntoma</label>
                </FloatLabel>
            </div>

            <template #footer>
                <Button label="Cancelar" severity="secondary" @click="visibleCitaDialog = false" />
                <Button label="Agendar" icon="pi pi-check" @click="guardarCita()" />
            </template>
        </Dialog>

        <!-- Paciente nuevo (mismo formulario que Pacientes.vue), para que al -->
        <!-- verlo luego en Gestión de Pacientes ya tenga todos los datos. -->
        <Dialog v-model:visible="visibleNuevoPacienteDialog" header="Nuevo Paciente" :modal="true" :style="{ width: '700px' }" :breakpoints="{ '960px': '90vw' }">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div class="flex flex-col gap-2">
                    <FloatLabel class="w-full">
                        <InputText id="np_first_name" v-model="pacienteNuevo.first_name" class="w-full" />
                        <label for="np_first_name">Nombre</label>
                    </FloatLabel>
                    <small v-if="erroresPaciente.first_name" class="text-red-500">{{ erroresPaciente.first_name[0] }}</small>
                </div>

                <div class="flex flex-col gap-2">
                    <FloatLabel class="w-full">
                        <InputText id="np_last_name" v-model="pacienteNuevo.last_name" class="w-full" />
                        <label for="np_last_name">Apellido</label>
                    </FloatLabel>
                    <small v-if="erroresPaciente.last_name" class="text-red-500">{{ erroresPaciente.last_name[0] }}</small>
                </div>

                <div class="flex flex-col gap-2">
                    <FloatLabel class="w-full">
                        <InputText id="np_cedula" v-model="pacienteNuevo.cedula" class="w-full" />
                        <label for="np_cedula">Cédula</label>
                    </FloatLabel>
                    <small v-if="erroresPaciente.cedula" class="text-red-500">{{ erroresPaciente.cedula[0] }}</small>
                </div>

                <div class="flex flex-col gap-2">
                    <FloatLabel class="w-full">
                        <InputText id="np_pasaporte" v-model="pacienteNuevo.pasaporte" class="w-full" />
                        <label for="np_pasaporte">Pasaporte (si es extranjero)</label>
                    </FloatLabel>
                    <small v-if="erroresPaciente.pasaporte" class="text-red-500">{{ erroresPaciente.pasaporte[0] }}</small>
                </div>

                <div class="flex flex-col gap-2">
                    <FloatLabel class="w-full">
                        <DatePicker id="np_birth_date" v-model="pacienteNuevo.birth_date" class="w-full" dateFormat="dd/mm/yy" showIcon iconDisplay="input" />
                        <label for="np_birth_date">Fecha de nacimiento</label>
                    </FloatLabel>
                    <small v-if="erroresPaciente.birth_date" class="text-red-500">{{ erroresPaciente.birth_date[0] }}</small>
                </div>

                <div class="flex flex-col gap-2">
                    <FloatLabel class="w-full">
                        <InputText id="np_phone" v-model="pacienteNuevo.phone" class="w-full" />
                        <label for="np_phone">Teléfono</label>
                    </FloatLabel>
                    <small v-if="erroresPaciente.phone" class="text-red-500">{{ erroresPaciente.phone[0] }}</small>
                </div>

                <div class="flex flex-col gap-2">
                    <FloatLabel class="w-full">
                        <InputText id="np_email" v-model="pacienteNuevo.email" class="w-full" />
                        <label for="np_email">Email</label>
                    </FloatLabel>
                    <small v-if="erroresPaciente.email" class="text-red-500">{{ erroresPaciente.email[0] }}</small>
                </div>

                <div class="flex flex-col gap-2">
                    <FloatLabel class="w-full">
                        <InputText id="np_insurance" v-model="pacienteNuevo.insurance" class="w-full" />
                        <label for="np_insurance">Seguro médico</label>
                    </FloatLabel>
                </div>

                <div class="flex flex-col gap-2">
                    <FloatLabel class="w-full">
                        <InputText id="np_emergency_contact" v-model="pacienteNuevo.emergency_contact" class="w-full" />
                        <label for="np_emergency_contact">Contacto de emergencia</label>
                    </FloatLabel>
                </div>

                <div class="flex flex-col gap-2 sm:col-span-2">
                    <FloatLabel class="w-full">
                        <InputText id="np_emergency_phone" v-model="pacienteNuevo.emergency_phone" class="w-full" />
                        <label for="np_emergency_phone">Teléfono de emergencia</label>
                    </FloatLabel>
                </div>

                <div class="flex flex-col gap-2 sm:col-span-2">
                    <FloatLabel class="w-full">
                        <Textarea id="np_address" v-model="pacienteNuevo.address" class="w-full" rows="2" autoResize />
                        <label for="np_address">Dirección</label>
                    </FloatLabel>
                </div>

                <div class="flex flex-col gap-2 sm:col-span-2">
                    <FloatLabel class="w-full">
                        <Textarea id="np_medical_conditions" v-model="pacienteNuevo.medical_conditions" class="w-full" rows="3" autoResize />
                        <label for="np_medical_conditions">Condiciones médicas</label>
                    </FloatLabel>
                </div>
            </div>

            <template #footer>
                <Button label="Cancelar" severity="secondary" @click="visibleNuevoPacienteDialog = false" />
                <Button label="Guardar y agendar" icon="pi pi-check" @click="guardarNuevoPacienteYCita()" />
            </template>
        </Dialog>
    </div>
</template>

<style scoped>
/* "Nueva cita" es sólido con el color de marca a propósito, igual que el
   resto de botones "Nueva..." de la app (ver CLAUDE.md) — el hover
   compartido de _tokens.scss pone el mismo --primary-color de fondo que ya
   tiene en reposo, así que ahí no se nota nada. Se oscurece con un filter
   en vez de cambiar el color base, para no romper esa convención ni
   depender del hex real de --primary-color (que varía por médico). */
.btn-nueva-cita:hover {
    filter: brightness(0.88);
}
</style>
