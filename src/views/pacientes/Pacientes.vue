<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { funListarPacientes, funGuardarPaciente, funActualizarPaciente, funEliminarPaciente } from '@/service/patient.service';
import { getUser } from '@/service/auth.service';
import Toast from 'primevue/toast';
import Toolbar from 'primevue/toolbar';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import Dialog from 'primevue/dialog';
import FloatLabel from 'primevue/floatlabel';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import DatePicker from 'primevue/datepicker';
import Textarea from 'primevue/textarea';
import { FilterMatchMode } from '@primevue/core/api';
import { useToast } from 'primevue/usetoast';
import ConfirmDialog from 'primevue/confirmdialog';
import { useConfirm } from 'primevue/useconfirm';

const toast = useToast();
const confirm = useConfirm();
const router = useRouter();
const errores = ref({});
const visibleDialog = ref(false);
const editando = ref(false);

// Solo el médico (admin) puede eliminar pacientes; la secretaria crea y edita, no borra.
const esMedico = getUser()?.role === 'admin';

// Historial médico y recetas: solo médico y superadmin, la secretaria no accede.
const puedeVerHistorial = ['admin', 'superadmin'].includes(getUser()?.role);

const pacientes = ref([]);

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

const paciente = ref({ ...pacienteVacio });

const filters = ref({
    global: {
        value: null,
        matchMode: FilterMatchMode.CONTAINS
    }
});

const nuevoPaciente = () => {
    errores.value = {};
    editando.value = false;
    paciente.value = { ...pacienteVacio };
    visibleDialog.value = true;
};

// Convierte 'YYYY-MM-DD' (string que llega del backend) a un objeto Date para el DatePicker
const parsearFecha = (fechaStr) => {
    return fechaStr ? new Date(fechaStr) : null;
};

const editarPaciente = (pacienteSeleccionado) => {
    errores.value = {};
    editando.value = true;

    paciente.value = {
        id: pacienteSeleccionado.id,
        first_name: pacienteSeleccionado.first_name,
        last_name: pacienteSeleccionado.last_name,
        cedula: pacienteSeleccionado.cedula,
        pasaporte: pacienteSeleccionado.pasaporte,
        birth_date: parsearFecha(pacienteSeleccionado.birth_date),
        phone: pacienteSeleccionado.phone,
        email: pacienteSeleccionado.email,
        address: pacienteSeleccionado.address,
        insurance: pacienteSeleccionado.insurance,
        emergency_contact: pacienteSeleccionado.emergency_contact,
        emergency_phone: pacienteSeleccionado.emergency_phone,
        medical_conditions: pacienteSeleccionado.medical_conditions
    };

    visibleDialog.value = true;
};

// Convierte el objeto Date del DatePicker a 'YYYY-MM-DD' para el backend
const formatearFecha = (fecha) => {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
};

// Función para guardar o actualizar paciente, según corresponda
const guardarPaciente = async () => {
    try {
        const datosEnviar = {
            ...paciente.value,
            birth_date: paciente.value.birth_date ? formatearFecha(paciente.value.birth_date) : null
        };

        if (editando.value) {
            await funActualizarPaciente(paciente.value.id, datosEnviar);
        } else {
            await funGuardarPaciente(datosEnviar);
        }

        toast.add({
            severity: 'success',
            summary: editando.value ? 'Paciente actualizado' : 'Paciente creado',
            detail: editando.value ? 'Los datos fueron actualizados correctamente' : 'El paciente fue registrado correctamente',
            life: 3000
        });

        visibleDialog.value = false;

        pacientes.value = await funListarPacientes();

        paciente.value = { ...pacienteVacio };
    } catch (error) {
        console.error(error);

        if (error.response?.status === 422) {
            errores.value = error.response.data.errors;

            toast.add({
                severity: 'warn',
                summary: 'Datos inválidos',
                detail: 'Revisa los campos marcados',
                life: 3000
            });
        } else if (error.response?.status === 403) {
            toast.add({
                severity: 'error',
                summary: 'No autorizado',
                detail: error.response.data.message,
                life: 3000
            });
        } else {
            toast.add({
                severity: 'error',
                summary: 'Error',
                detail: 'Ocurrió un error inesperado',
                life: 3000
            });
        }
    }
};

const eliminarPaciente = (pacienteSeleccionado) => {
    confirm.require({
        message: `¿Desea eliminar al paciente ${pacienteSeleccionado.first_name} ${pacienteSeleccionado.last_name}?`,
        header: 'Confirmar eliminación',
        acceptLabel: 'Eliminar',
        rejectLabel: 'Cancelar',
        acceptClass: 'p-button-danger',

        accept: async () => {
            try {
                await funEliminarPaciente(pacienteSeleccionado.id);

                pacientes.value = await funListarPacientes();

                toast.add({
                    severity: 'success',
                    summary: 'Paciente eliminado',
                    detail: 'El paciente fue eliminado correctamente',
                    life: 3000
                });
            } catch (error) {
                console.error(error);

                toast.add({
                    severity: 'error',
                    summary: 'No autorizado',
                    detail: error.response?.data?.message ?? 'Ocurrió un error inesperado',
                    life: 3000
                });
            }
        }
    });
};

onMounted(async () => {
    try {
        pacientes.value = await funListarPacientes();
    } catch (error) {
        console.error(error);
    }
});
</script>

<template>
    <div class="card">
        <ConfirmDialog />
        <Toast />
        <Toolbar class="mb-4">
            <template #start>
                <div>
                    <h2 class="m-0">Gestión de Pacientes</h2>
                    <small class="text-surface-500"> Pacientes registrados en el sistema. </small>
                </div>
            </template>

            <template #end>
                <Button label="Nuevo Paciente" icon="pi pi-user-plus" @click="nuevoPaciente()" />
            </template>
        </Toolbar>

        <div class="flex justify-end mb-4">
            <IconField>
                <InputIcon class="pi pi-search" />
                <InputText v-model="filters.global.value" placeholder="Buscar por cédula o pasaporte..." autocomplete="off" />
            </IconField>
        </div>

        <DataTable
            :value="pacientes"
            v-model:filters="filters"
            filterDisplay="menu"
            :globalFilterFields="['cedula', 'pasaporte']"
            paginator
            :rows="10"
            stripedRows
            showGridlines
            responsiveLayout="scroll"
        >
            <Column field="id" header="ID"></Column>
            <Column field="first_name" header="Nombre"></Column>
            <Column field="last_name" header="Apellido"></Column>
            <Column field="cedula" header="Cédula"></Column>
            <Column field="pasaporte" header="Pasaporte"></Column>
            <Column field="phone" header="Teléfono"></Column>
            <Column field="email" header="Email"></Column>
            <Column header="Acciones">
                <template #body="slotProps">
                    <div class="flex gap-2">
                        <Button v-if="puedeVerHistorial" icon="pi pi-book" severity="secondary" rounded @click="router.push(`/pacientes/${slotProps.data.id}/historial`)" />
                        <Button icon="pi pi-pencil" severity="info" rounded @click="editarPaciente(slotProps.data)" />
                        <Button v-if="esMedico" icon="pi pi-trash" severity="danger" rounded @click="eliminarPaciente(slotProps.data)" />
                    </div>
                </template>
            </Column>
        </DataTable>

        <Dialog v-model:visible="visibleDialog" :header="editando ? 'Editar Paciente' : 'Nuevo Paciente'" :modal="true" :style="{ width: '700px' }" :breakpoints="{ '960px': '90vw' }">
            <div class="grid grid-cols-2 gap-4 pt-2">
                <div class="flex flex-col gap-2">
                    <FloatLabel class="w-full">
                        <InputText id="first_name" v-model="paciente.first_name" class="w-full" />
                        <label for="first_name">Nombre</label>
                    </FloatLabel>
                    <small v-if="errores.first_name" class="text-red-500">{{ errores.first_name[0] }}</small>
                </div>

                <div class="flex flex-col gap-2">
                    <FloatLabel class="w-full">
                        <InputText id="last_name" v-model="paciente.last_name" class="w-full" />
                        <label for="last_name">Apellido</label>
                    </FloatLabel>
                    <small v-if="errores.last_name" class="text-red-500">{{ errores.last_name[0] }}</small>
                </div>

                <div class="flex flex-col gap-2">
                    <FloatLabel class="w-full">
                        <InputText id="cedula" v-model="paciente.cedula" class="w-full" />
                        <label for="cedula">Cédula</label>
                    </FloatLabel>
                    <small v-if="errores.cedula" class="text-red-500">{{ errores.cedula[0] }}</small>
                </div>

                <div class="flex flex-col gap-2">
                    <FloatLabel class="w-full">
                        <InputText id="pasaporte" v-model="paciente.pasaporte" class="w-full" />
                        <label for="pasaporte">Pasaporte (si es extranjero)</label>
                    </FloatLabel>
                    <small v-if="errores.pasaporte" class="text-red-500">{{ errores.pasaporte[0] }}</small>
                </div>

                <div class="flex flex-col gap-2">
                    <FloatLabel class="w-full">
                        <DatePicker id="birth_date" v-model="paciente.birth_date" class="w-full" dateFormat="dd/mm/yy" showIcon iconDisplay="input" />
                        <label for="birth_date">Fecha de nacimiento</label>
                    </FloatLabel>
                    <small v-if="errores.birth_date" class="text-red-500">{{ errores.birth_date[0] }}</small>
                </div>

                <div class="flex flex-col gap-2">
                    <FloatLabel class="w-full">
                        <InputText id="phone" v-model="paciente.phone" class="w-full" />
                        <label for="phone">Teléfono</label>
                    </FloatLabel>
                    <small v-if="errores.phone" class="text-red-500">{{ errores.phone[0] }}</small>
                </div>

                <div class="flex flex-col gap-2">
                    <FloatLabel class="w-full">
                        <InputText id="email" v-model="paciente.email" class="w-full" />
                        <label for="email">Email</label>
                    </FloatLabel>
                    <small v-if="errores.email" class="text-red-500">{{ errores.email[0] }}</small>
                </div>

                <div class="flex flex-col gap-2">
                    <FloatLabel class="w-full">
                        <InputText id="insurance" v-model="paciente.insurance" class="w-full" />
                        <label for="insurance">Seguro médico</label>
                    </FloatLabel>
                </div>

                <div class="flex flex-col gap-2">
                    <FloatLabel class="w-full">
                        <InputText id="emergency_contact" v-model="paciente.emergency_contact" class="w-full" />
                        <label for="emergency_contact">Contacto de emergencia</label>
                    </FloatLabel>
                </div>

                <div class="flex flex-col gap-2 col-span-2">
                    <FloatLabel class="w-full">
                        <InputText id="emergency_phone" v-model="paciente.emergency_phone" class="w-full" />
                        <label for="emergency_phone">Teléfono de emergencia</label>
                    </FloatLabel>
                </div>

                <div class="flex flex-col gap-2 col-span-2">
                    <FloatLabel class="w-full">
                        <Textarea id="address" v-model="paciente.address" class="w-full" rows="2" autoResize />
                        <label for="address">Dirección</label>
                    </FloatLabel>
                </div>

                <div class="flex flex-col gap-2 col-span-2">
                    <FloatLabel class="w-full">
                        <Textarea id="medical_conditions" v-model="paciente.medical_conditions" class="w-full" rows="3" autoResize />
                        <label for="medical_conditions">Condiciones médicas</label>
                    </FloatLabel>
                </div>
            </div>

            <template #footer>
                <Button label="Cancelar" severity="secondary" @click="visibleDialog = false" />
                <Button :label="editando ? 'Actualizar' : 'Guardar'" icon="pi pi-check" @click="guardarPaciente()" />
            </template>
        </Dialog>
    </div>
</template>
