<script setup>
import { onMounted, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { funObtenerPaciente, funListarPacientes } from '@/service/patient.service';
import { funListarHistorial, funGuardarHistorial, funActualizarHistorial, funEliminarHistorial } from '@/service/historial.service';
import { funListarRecetas, funGuardarReceta, funActualizarReceta, funEliminarReceta } from '@/service/receta.service';
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
import Select from 'primevue/select';
import ConfirmDialog from 'primevue/confirmdialog';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const confirm = useConfirm();

const patientId = Number(route.params.id);
const paciente = ref(null);

// Solo el médico (admin) puede eliminar; superadmin y médico pueden crear/editar.
const esMedico = getUser()?.role === 'admin';

const errores = ref({});

// ============ Buscar otro paciente por cédula ============
const busquedaCedula = ref('');

const buscarPorCedula = async () => {
    if (!busquedaCedula.value.trim()) {
        return;
    }

    try {
        const pacientes = await funListarPacientes();
        const encontrado = pacientes.find((p) => p.cedula === busquedaCedula.value.trim());

        if (!encontrado) {
            toast.add({ severity: 'warn', summary: 'No encontrado', detail: 'Ningún paciente tiene esa cédula', life: 3000 });
            return;
        }

        router.push(`/pacientes/${encontrado.id}/historial`);
    } catch (error) {
        console.error(error);
    }
};

// ============ Impresión ============
const imprimirDocumento = (titulo, contenidoHtml) => {
    const ventana = window.open('', '_blank');

    ventana.document.write(`
        <html>
            <head>
                <title>${titulo}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 2rem; color: #222; }
                    h1 { font-size: 1.3rem; border-bottom: 2px solid #333; padding-bottom: 0.5rem; }
                    .campo { margin-bottom: 1rem; }
                    .campo label { display: block; font-weight: bold; font-size: 0.85rem; color: #555; }
                    .campo p { margin: 0.2rem 0 0; white-space: pre-wrap; }
                </style>
            </head>
            <body>
                <h1>${titulo}</h1>
                ${contenidoHtml}
            </body>
        </html>
    `);

    ventana.document.close();
    ventana.focus();
    ventana.print();
};

// ============ Historial médico ============
const historial = ref([]);
const visibleHistorialDialog = ref(false);
const editandoHistorial = ref(false);

const historialVacio = {
    id: null,
    fecha_consulta: null,
    motivo_consulta: '',
    diagnostico: '',
    tratamiento: '',
    dieta: '',
    observaciones: ''
};

const entradaHistorial = ref({ ...historialVacio });

// Filtro por fecha de consulta (sobre lo ya cargado, sin volver a pedir al backend)
const filtroFecha = ref(null);

const historialFiltrado = computed(() => {
    if (!filtroFecha.value) {
        return historial.value;
    }

    const fechaFiltro = formatearFecha(filtroFecha.value);

    return historial.value.filter((h) => h.fecha_consulta === fechaFiltro);
});

const parsearFecha = (fechaStr) => (fechaStr ? new Date(fechaStr) : null);

function formatearFecha(fecha) {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
}

const cargarHistorial = async () => {
    historial.value = await funListarHistorial(patientId);
};

const nuevaEntradaHistorial = () => {
    errores.value = {};
    editandoHistorial.value = false;
    entradaHistorial.value = { ...historialVacio, fecha_consulta: new Date() };
    visibleHistorialDialog.value = true;
};

const editarEntradaHistorial = (entrada) => {
    errores.value = {};
    editandoHistorial.value = true;
    entradaHistorial.value = {
        id: entrada.id,
        fecha_consulta: parsearFecha(entrada.fecha_consulta),
        motivo_consulta: entrada.motivo_consulta,
        diagnostico: entrada.diagnostico,
        tratamiento: entrada.tratamiento,
        dieta: entrada.dieta,
        observaciones: entrada.observaciones
    };
    visibleHistorialDialog.value = true;
};

const guardarEntradaHistorial = async () => {
    try {
        const datos = {
            patient_id: patientId,
            fecha_consulta: entradaHistorial.value.fecha_consulta ? formatearFecha(entradaHistorial.value.fecha_consulta) : null,
            motivo_consulta: entradaHistorial.value.motivo_consulta,
            diagnostico: entradaHistorial.value.diagnostico,
            tratamiento: entradaHistorial.value.tratamiento,
            dieta: entradaHistorial.value.dieta,
            observaciones: entradaHistorial.value.observaciones
        };

        if (editandoHistorial.value) {
            await funActualizarHistorial(entradaHistorial.value.id, datos);
        } else {
            await funGuardarHistorial(datos);
        }

        toast.add({
            severity: 'success',
            summary: editandoHistorial.value ? 'Historial actualizado' : 'Historial creado',
            detail: 'Los datos fueron guardados correctamente',
            life: 3000
        });

        visibleHistorialDialog.value = false;
        await cargarHistorial();
    } catch (error) {
        console.error(error);

        if (error.response?.status === 422) {
            errores.value = error.response.data.errors ?? {};
        }

        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: error.response?.data?.message ?? 'Ocurrió un error inesperado',
            life: 3000
        });
    }
};

const imprimirHistorial = (entrada) => {
    const nombrePaciente = paciente.value ? `${paciente.value.first_name} ${paciente.value.last_name}` : '';

    imprimirDocumento(
        'Historial clínico',
        `
        <div class="campo"><label>Paciente</label><p>${nombrePaciente}</p></div>
        <div class="campo"><label>Fecha de consulta</label><p>${entrada.fecha_consulta ?? ''}</p></div>
        <div class="campo"><label>Motivo de consulta</label><p>${entrada.motivo_consulta ?? ''}</p></div>
        <div class="campo"><label>Diagnóstico</label><p>${entrada.diagnostico ?? ''}</p></div>
        <div class="campo"><label>Tratamiento</label><p>${entrada.tratamiento ?? ''}</p></div>
        <div class="campo"><label>Dieta</label><p>${entrada.dieta ?? ''}</p></div>
        <div class="campo"><label>Observaciones</label><p>${entrada.observaciones ?? ''}</p></div>
        `
    );
};

const imprimirDieta = (entrada) => {
    const nombrePaciente = paciente.value ? `${paciente.value.first_name} ${paciente.value.last_name}` : '';

    imprimirDocumento(
        'Plan de dieta',
        `
        <div class="campo"><label>Paciente</label><p>${nombrePaciente}</p></div>
        <div class="campo"><label>Fecha</label><p>${entrada.fecha_consulta ?? ''}</p></div>
        <div class="campo"><label>Dieta indicada</label><p>${entrada.dieta ?? 'Sin dieta registrada'}</p></div>
        `
    );
};

const eliminarEntradaHistorial = (entrada) => {
    confirm.require({
        message: '¿Desea eliminar esta entrada del historial médico?',
        header: 'Confirmar eliminación',
        acceptLabel: 'Eliminar',
        rejectLabel: 'Cancelar',
        acceptClass: 'p-button-danger',

        accept: async () => {
            try {
                await funEliminarHistorial(entrada.id);
                await cargarHistorial();

                toast.add({
                    severity: 'success',
                    summary: 'Historial eliminado',
                    detail: 'La entrada fue eliminada correctamente',
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

// ============ Recetas ============
const recetas = ref([]);
const visibleRecetaDialog = ref(false);
const editandoReceta = ref(false);

const recetaVacia = {
    id: null,
    historial_medico_id: null,
    fecha_emision: null,
    medicamentos: '',
    indicaciones: ''
};

const receta = ref({ ...recetaVacia });

const opcionesHistorial = computed(() =>
    historial.value.map((h) => ({
        label: `${h.fecha_consulta} — ${h.diagnostico}`,
        value: h.id
    }))
);

const cargarRecetas = async () => {
    recetas.value = await funListarRecetas(patientId);
};

const nuevaReceta = () => {
    errores.value = {};
    editandoReceta.value = false;
    receta.value = { ...recetaVacia, fecha_emision: new Date() };
    visibleRecetaDialog.value = true;
};

const editarReceta = (recetaSeleccionada) => {
    errores.value = {};
    editandoReceta.value = true;
    receta.value = {
        id: recetaSeleccionada.id,
        historial_medico_id: recetaSeleccionada.historial_medico_id,
        fecha_emision: parsearFecha(recetaSeleccionada.fecha_emision),
        medicamentos: recetaSeleccionada.medicamentos,
        indicaciones: recetaSeleccionada.indicaciones
    };
    visibleRecetaDialog.value = true;
};

const guardarReceta = async () => {
    try {
        const datos = {
            patient_id: patientId,
            historial_medico_id: receta.value.historial_medico_id,
            fecha_emision: receta.value.fecha_emision ? formatearFecha(receta.value.fecha_emision) : null,
            medicamentos: receta.value.medicamentos,
            indicaciones: receta.value.indicaciones
        };

        if (editandoReceta.value) {
            await funActualizarReceta(receta.value.id, datos);
        } else {
            await funGuardarReceta(datos);
        }

        toast.add({
            severity: 'success',
            summary: editandoReceta.value ? 'Receta actualizada' : 'Receta creada',
            detail: 'Los datos fueron guardados correctamente',
            life: 3000
        });

        visibleRecetaDialog.value = false;
        await cargarRecetas();
    } catch (error) {
        console.error(error);

        if (error.response?.status === 422) {
            errores.value = error.response.data.errors ?? {};
        }

        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: error.response?.data?.message ?? 'Ocurrió un error inesperado',
            life: 3000
        });
    }
};

const eliminarReceta = (recetaSeleccionada) => {
    confirm.require({
        message: '¿Desea eliminar esta receta?',
        header: 'Confirmar eliminación',
        acceptLabel: 'Eliminar',
        rejectLabel: 'Cancelar',
        acceptClass: 'p-button-danger',

        accept: async () => {
            try {
                await funEliminarReceta(recetaSeleccionada.id);
                await cargarRecetas();

                toast.add({
                    severity: 'success',
                    summary: 'Receta eliminada',
                    detail: 'La receta fue eliminada correctamente',
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

const imprimirReceta = (recetaSeleccionada) => {
    const nombrePaciente = paciente.value ? `${paciente.value.first_name} ${paciente.value.last_name}` : '';

    imprimirDocumento(
        'Receta médica',
        `
        <div class="campo"><label>Paciente</label><p>${nombrePaciente}</p></div>
        <div class="campo"><label>Fecha de emisión</label><p>${recetaSeleccionada.fecha_emision ?? ''}</p></div>
        <div class="campo"><label>Medicamentos</label><p>${recetaSeleccionada.medicamentos ?? ''}</p></div>
        <div class="campo"><label>Indicaciones</label><p>${recetaSeleccionada.indicaciones ?? 'Ninguna'}</p></div>
        `
    );
};

onMounted(async () => {
    try {
        paciente.value = await funObtenerPaciente(patientId);
        await Promise.all([cargarHistorial(), cargarRecetas()]);
    } catch (error) {
        console.error(error);

        toast.add({
            severity: 'error',
            summary: 'No autorizado',
            detail: error.response?.data?.message ?? 'No se pudo cargar la información del paciente',
            life: 3000
        });
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
                    <Button icon="pi pi-arrow-left" text @click="router.push('/pacientes')" />
                    <span class="ml-2">
                        <h2 class="m-0 inline-block">Historial clínico</h2>
                        <br />
                        <small class="text-surface-500" v-if="paciente"> {{ paciente.first_name }} {{ paciente.last_name }} — CI {{ paciente.cedula }} </small>
                    </span>
                </div>
            </template>

            <template #end>
                <IconField>
                    <InputIcon class="pi pi-search" />
                    <InputText v-model="busquedaCedula" placeholder="Buscar paciente por cédula..." autocomplete="off" @keyup.enter="buscarPorCedula()" />
                </IconField>
                <Button icon="pi pi-arrow-right" class="ml-2" @click="buscarPorCedula()" />
            </template>
        </Toolbar>

        <!-- Historial médico -->
        <div class="flex justify-between items-center mb-3">
            <h3 class="m-0">Consultas</h3>
            <div class="flex items-center gap-2">
                <FloatLabel>
                    <DatePicker id="filtroFecha" v-model="filtroFecha" dateFormat="dd/mm/yy" showIcon iconDisplay="input" showButtonBar />
                    <label for="filtroFecha">Filtrar por fecha</label>
                </FloatLabel>
                <Button label="Nueva consulta" icon="pi pi-plus" @click="nuevaEntradaHistorial()" />
            </div>
        </div>

        <DataTable :value="historialFiltrado" paginator :rows="5" stripedRows showGridlines class="mb-6">
            <Column field="fecha_consulta" header="Fecha"></Column>
            <Column field="motivo_consulta" header="Motivo"></Column>
            <Column field="diagnostico" header="Diagnóstico"></Column>
            <Column field="tratamiento" header="Tratamiento"></Column>
            <Column field="dieta" header="Dieta"></Column>
            <Column header="Acciones">
                <template #body="slotProps">
                    <div class="flex gap-2">
                        <Button icon="pi pi-pencil" severity="info" rounded @click="editarEntradaHistorial(slotProps.data)" />
                        <Button icon="pi pi-print" severity="secondary" rounded @click="imprimirHistorial(slotProps.data)" v-tooltip.top="'Imprimir historial'" />
                        <Button icon="pi pi-book" severity="help" rounded @click="imprimirDieta(slotProps.data)" v-tooltip.top="'Imprimir dieta'" />
                        <Button v-if="esMedico" icon="pi pi-trash" severity="danger" rounded @click="eliminarEntradaHistorial(slotProps.data)" />
                    </div>
                </template>
            </Column>
        </DataTable>

        <!-- Recetas -->
        <div class="flex justify-between items-center mb-3">
            <h3 class="m-0">Recetas</h3>
            <Button label="Nueva receta" icon="pi pi-plus" @click="nuevaReceta()" />
        </div>

        <DataTable :value="recetas" paginator :rows="5" stripedRows showGridlines>
            <Column field="fecha_emision" header="Fecha"></Column>
            <Column field="medicamentos" header="Medicamentos"></Column>
            <Column field="indicaciones" header="Indicaciones"></Column>
            <Column header="Acciones">
                <template #body="slotProps">
                    <div class="flex gap-2">
                        <Button icon="pi pi-pencil" severity="info" rounded @click="editarReceta(slotProps.data)" />
                        <Button icon="pi pi-print" severity="secondary" rounded @click="imprimirReceta(slotProps.data)" v-tooltip.top="'Imprimir receta'" />
                        <Button v-if="esMedico" icon="pi pi-trash" severity="danger" rounded @click="eliminarReceta(slotProps.data)" />
                    </div>
                </template>
            </Column>
        </DataTable>

        <!-- Dialog: entrada de historial -->
        <Dialog v-model:visible="visibleHistorialDialog" :header="editandoHistorial ? 'Editar consulta' : 'Nueva consulta'" :modal="true" :style="{ width: '650px' }" :breakpoints="{ '960px': '90vw' }">
            <div class="flex flex-col gap-3 pt-2">
                <FloatLabel class="w-full">
                    <DatePicker id="fecha_consulta" v-model="entradaHistorial.fecha_consulta" class="w-full" dateFormat="dd/mm/yy" showIcon iconDisplay="input" />
                    <label for="fecha_consulta">Fecha de consulta</label>
                </FloatLabel>
                <small v-if="errores.fecha_consulta" class="text-red-500">{{ errores.fecha_consulta[0] }}</small>

                <FloatLabel class="w-full">
                    <Textarea id="motivo_consulta" v-model="entradaHistorial.motivo_consulta" class="w-full" rows="2" autoResize />
                    <label for="motivo_consulta">Motivo de consulta</label>
                </FloatLabel>
                <small v-if="errores.motivo_consulta" class="text-red-500">{{ errores.motivo_consulta[0] }}</small>

                <FloatLabel class="w-full">
                    <Textarea id="diagnostico" v-model="entradaHistorial.diagnostico" class="w-full" rows="2" autoResize />
                    <label for="diagnostico">Diagnóstico</label>
                </FloatLabel>
                <small v-if="errores.diagnostico" class="text-red-500">{{ errores.diagnostico[0] }}</small>

                <FloatLabel class="w-full">
                    <Textarea id="tratamiento" v-model="entradaHistorial.tratamiento" class="w-full" rows="2" autoResize />
                    <label for="tratamiento">Tratamiento</label>
                </FloatLabel>

                <FloatLabel class="w-full">
                    <Textarea id="dieta" v-model="entradaHistorial.dieta" class="w-full" rows="2" autoResize />
                    <label for="dieta">Dieta</label>
                </FloatLabel>

                <FloatLabel class="w-full">
                    <Textarea id="observaciones" v-model="entradaHistorial.observaciones" class="w-full" rows="2" autoResize />
                    <label for="observaciones">Observaciones</label>
                </FloatLabel>
            </div>

            <template #footer>
                <Button label="Cancelar" severity="secondary" @click="visibleHistorialDialog = false" />
                <Button :label="editandoHistorial ? 'Actualizar' : 'Guardar'" icon="pi pi-check" @click="guardarEntradaHistorial()" />
            </template>
        </Dialog>

        <!-- Dialog: receta -->
        <Dialog v-model:visible="visibleRecetaDialog" :header="editandoReceta ? 'Editar receta' : 'Nueva receta'" :modal="true" :style="{ width: '650px' }" :breakpoints="{ '960px': '90vw' }">
            <div class="flex flex-col gap-3 pt-2">
                <FloatLabel class="w-full">
                    <DatePicker id="fecha_emision" v-model="receta.fecha_emision" class="w-full" dateFormat="dd/mm/yy" showIcon iconDisplay="input" />
                    <label for="fecha_emision">Fecha de emisión</label>
                </FloatLabel>
                <small v-if="errores.fecha_emision" class="text-red-500">{{ errores.fecha_emision[0] }}</small>

                <FloatLabel class="w-full">
                    <Select
                        id="historial_medico_id"
                        v-model="receta.historial_medico_id"
                        :options="opcionesHistorial"
                        optionLabel="label"
                        optionValue="value"
                        showClear
                        class="w-full"
                        :placeholder="opcionesHistorial.length ? 'Selecciona una consulta' : 'Este paciente aún no tiene consultas registradas'"
                        :disabled="!opcionesHistorial.length"
                    />
                    <label for="historial_medico_id">Consulta relacionada (opcional)</label>
                </FloatLabel>

                <FloatLabel class="w-full">
                    <Textarea id="medicamentos" v-model="receta.medicamentos" class="w-full" rows="3" autoResize />
                    <label for="medicamentos">Medicamentos</label>
                </FloatLabel>
                <small v-if="errores.medicamentos" class="text-red-500">{{ errores.medicamentos[0] }}</small>

                <FloatLabel class="w-full">
                    <Textarea id="indicaciones" v-model="receta.indicaciones" class="w-full" rows="2" autoResize />
                    <label for="indicaciones">Indicaciones</label>
                </FloatLabel>
            </div>

            <template #footer>
                <Button label="Cancelar" severity="secondary" @click="visibleRecetaDialog = false" />
                <Button :label="editandoReceta ? 'Actualizar' : 'Guardar'" icon="pi pi-check" @click="guardarReceta()" />
            </template>
        </Dialog>
    </div>
</template>
