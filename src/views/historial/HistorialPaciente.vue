<script setup>
import { onMounted, ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { funObtenerPaciente, funListarPacientes, funBuscarPacienteEliminado } from '@/service/patient.service';
import { funListarHistorial, funGuardarHistorial, funActualizarHistorial, funEliminarHistorial } from '@/service/historial.service';
import { funListarRecetas, funGuardarReceta, funActualizarReceta, funEliminarReceta } from '@/service/receta.service';
import { funListarAutorizaciones, funGuardarAutorizacion, funActualizarAutorizacion, funEliminarAutorizacion } from '@/service/autorizacion.service';
import { funListarLicencias, funGuardarLicencia, funActualizarLicencia, funEliminarLicencia } from '@/service/licencia.service';
import { funListarDietas, funGuardarDieta, funActualizarDieta, funEliminarDieta } from '@/service/dieta.service';
import { funListarEstudios, funGuardarEstudio, funActualizarEstudio, funEliminarEstudio } from '@/service/estudio.service';
import { getUser } from '@/service/auth.service';
import { useBranding } from '@/composables/useBranding';
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
import FileUpload from 'primevue/fileupload';
import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import TabPanels from 'primevue/tabpanels';
import TabPanel from 'primevue/tabpanel';
import ConfirmDialog from 'primevue/confirmdialog';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const confirm = useConfirm();

// Reactivo (no una constante fija): si se entra sin id (ej. desde "Historial
// clínico" en Accesos rápidos del Dashboard) y luego se busca un paciente por
// cédula, la navegación a /pacientes/:id/historial reutiliza esta misma
// instancia del componente (Vue Router no la remonta porque es la misma
// vista) — sin esto, el patientId.value quedaría congelado en null.
const patientId = computed(() => (route.params.id ? Number(route.params.id) : null));
const paciente = ref(null);

// Un paciente eliminado (soft delete) igual se puede consultar por cédula o
// pasaporte (ver buscarPorCedula) para ver su ficha e historial completo,
// pero de solo lectura: no se puede crear/editar/eliminar nada mientras esté
// en este estado (ver PatientPolicy::restore(), siempre false — no se
// reactiva desde acá).
const esEliminado = computed(() => !!paciente.value?.deleted_at);

const { branding, cargarBranding } = useBranding();

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
        const valor = busquedaCedula.value.trim();
        const pacientes = await funListarPacientes();
        let encontrado = pacientes.find((p) => p.cedula === valor || p.pasaporte === valor);

        // No está entre los activos: puede ser un paciente eliminado (soft
        // delete). Se consulta aparte para poder verlo de solo lectura.
        if (!encontrado) {
            try {
                encontrado = await funBuscarPacienteEliminado(valor);
            } catch (error) {
                if (error.response?.status !== 404) {
                    console.error(error);
                }
            }
        }

        if (!encontrado) {
            toast.add({ severity: 'warn', summary: 'Cédula o pasaporte inválido', detail: 'Coloque una cédula o un pasaporte válido', life: 3000 });
            return;
        }

        router.push(`/pacientes/${encontrado.id}/historial`);
        busquedaCedula.value = '';
    } catch (error) {
        console.error(error);
    }
};

// ============ Impresión ============
// Los datos del paciente/documento (nombre, motivo, diagnóstico, etc.) y del
// branding se arman a mano como HTML para la ventana de impresión — sin
// escapar, cualquier dato guardado con una etiqueta <script> se ejecutaría al
// imprimir. Toda interpolación de un valor que no sea texto fijo del propio
// código (título, etiquetas de campo) debe pasar por acá primero.
const escapeHtml = (valor) => {
    if (valor === null || valor === undefined) return '';

    return String(valor).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
};

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

    return historial.value.filter((h) => h.fecha_consulta?.slice(0, 10) === fechaFiltro);
});

// El backend serializa 'fecha' como YYYY-MM-DDT00:00:00.000000Z (UTC). Si se
// parsea con `new Date(fechaStr)` y se lee con getters locales, en zonas
// horarias detrás de UTC (ej. RD, UTC-4) el día se corre uno hacia atrás. Se
// arma la fecha a mano a partir de año/mes/día para evitar ese desfase.
const parsearFecha = (fechaStr) => {
    if (!fechaStr) return null;

    const [anio, mes, dia] = fechaStr.slice(0, 10).split('-').map(Number);
    return new Date(anio, mes - 1, dia);
};

function formatearFecha(fecha) {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
}

const cargarHistorial = async () => {
    historial.value = await funListarHistorial(patientId.value);
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
        observaciones: entrada.observaciones
    };
    visibleHistorialDialog.value = true;
};

const guardarEntradaHistorial = async () => {
    try {
        const datos = {
            patient_id: patientId.value,
            fecha_consulta: entradaHistorial.value.fecha_consulta ? formatearFecha(entradaHistorial.value.fecha_consulta) : null,
            motivo_consulta: entradaHistorial.value.motivo_consulta,
            diagnostico: entradaHistorial.value.diagnostico,
            tratamiento: entradaHistorial.value.tratamiento,
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
        <div class="campo"><label>Paciente</label><p>${escapeHtml(nombrePaciente)}</p></div>
        <div class="campo"><label>${paciente.value?.cedula ? 'Cédula' : 'Pasaporte'}</label><p>${escapeHtml(paciente.value?.cedula || paciente.value?.pasaporte)}</p></div>
        <div class="campo"><label>Fecha de consulta</label><p>${escapeHtml(entrada.fecha_consulta)}</p></div>
        <div class="campo"><label>Motivo de consulta</label><p>${escapeHtml(entrada.motivo_consulta)}</p></div>
        <div class="campo"><label>Diagnóstico</label><p>${escapeHtml(entrada.diagnostico)}</p></div>
        <div class="campo"><label>Tratamiento</label><p>${escapeHtml(entrada.tratamiento)}</p></div>
        <div class="campo"><label>Observaciones</label><p>${escapeHtml(entrada.observaciones)}</p></div>
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
    ars: '',
    medicamentos: '',
    indicaciones: ''
};

const receta = ref({ ...recetaVacia });

const opcionesHistorial = computed(() =>
    historial.value.map((h) => ({
        label: `${formatearFechaLegible(h.fecha_consulta)} — ${h.diagnostico}`,
        value: h.id
    }))
);

const cargarRecetas = async () => {
    recetas.value = await funListarRecetas(patientId.value);
};

const nuevaReceta = () => {
    errores.value = {};
    editandoReceta.value = false;
    // El ARS se precarga desde la ficha del paciente, pero queda editable:
    // puede diferir o haber cambiado desde que se registró al paciente.
    receta.value = { ...recetaVacia, fecha_emision: new Date(), ars: paciente.value?.insurance ?? '' };
    visibleRecetaDialog.value = true;
};

const editarReceta = (recetaSeleccionada) => {
    errores.value = {};
    editandoReceta.value = true;
    receta.value = {
        id: recetaSeleccionada.id,
        historial_medico_id: recetaSeleccionada.historial_medico_id,
        fecha_emision: parsearFecha(recetaSeleccionada.fecha_emision),
        ars: recetaSeleccionada.ars,
        medicamentos: recetaSeleccionada.medicamentos,
        indicaciones: recetaSeleccionada.indicaciones
    };
    visibleRecetaDialog.value = true;
};

const guardarReceta = async () => {
    try {
        const datos = {
            patient_id: patientId.value,
            historial_medico_id: receta.value.historial_medico_id,
            fecha_emision: receta.value.fecha_emision ? formatearFecha(receta.value.fecha_emision) : null,
            ars: receta.value.ars,
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

// "3:35 p. m." a partir de la marca de tiempo de creación del registro (no
// es un campo editable: la hora se guarda sola al crear la receta).
const formatearHoraLegible = (fechaHoraStr) => {
    if (!fechaHoraStr) return '';

    const fecha = new Date(fechaHoraStr);
    let horas = fecha.getHours();
    const minutos = String(fecha.getMinutes()).padStart(2, '0');
    const periodo = horas >= 12 ? 'p. m.' : 'a. m.';
    horas = horas % 12 || 12;

    return `${horas}:${minutos} ${periodo}`;
};

const imprimirReceta = (recetaSeleccionada) => {
    const nombrePaciente = paciente.value ? `${paciente.value.first_name} ${paciente.value.last_name}` : '';
    const edad = calcularEdadDetallada(paciente.value?.birth_date, recetaSeleccionada.fecha_emision);
    const ars = recetaSeleccionada.ars || 'No especificada';

    const ventana = window.open('', '_blank');

    ventana.document.write(`
        <html>
            <head>
                <title>Receta médica</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 2rem; color: #222; }
                    .header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
                    .header img { max-height: 90px; max-width: 110px; object-fit: contain; }
                    .header-credenciales { text-align: center; flex: 1; }
                    .header-credenciales h2 { margin: 0 0 0.25rem; font-size: 1.3rem; }
                    .header-credenciales .titulo-profesional { font-size: 0.95rem; font-style: italic; margin: 0 0 0.25rem; }
                    .header-credenciales .parrafo { font-size: 0.85rem; white-space: pre-line; line-height: 1.3; }
                    hr { border: none; border-top: 2px solid #333; margin: 1rem 0; }
                    .titulo-documento { text-align: center; font-weight: bold; font-size: 1.3rem; letter-spacing: 0.05em; margin-bottom: 1rem; }
                    .caja-titulo { border: 1px solid #333; display: flex; }
                    .col-izquierda { flex: 3; }
                    .datos-paciente { display: flex; }
                    .datos-paciente > div { padding: 0.6rem 1rem; }
                    .datos-paciente .col-paciente { flex: 2; border-right: 1px solid #333; }
                    .datos-paciente .col-ars { flex: 1.4; }
                    .col-derecha { flex: 1.1; border-left: 1px solid #333; padding: 0.75rem 1rem; }
                    .col-derecha div { margin-bottom: 0.4rem; }
                    .caja-contenido { border: 1px solid #333; border-top: none; padding: 1.5rem; min-height: 10rem; }
                    .rx-row { display: flex; gap: 1.25rem; }
                    .rx { font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-size: 2.75rem; line-height: 1; }
                    .rx-contenido { flex: 1; padding-top: 0.4rem; }
                    .rx-contenido p { margin: 0 0 1rem; white-space: pre-wrap; }
                </style>
            </head>
            <body>
                <div class="header">
                    ${branding.value.header_icon_left_url ? `<img src="${escapeHtml(branding.value.header_icon_left_url)}" alt="" />` : '<div></div>'}
                    <div class="header-credenciales">
                        <h2>${escapeHtml(branding.value.brand_name)}</h2>
                        ${branding.value.professional_title ? `<div class="titulo-profesional">${escapeHtml(branding.value.professional_title)}</div>` : ''}
                        <div class="parrafo">${escapeHtml(branding.value.header_credentials)}</div>
                    </div>
                    ${branding.value.header_icon_right_url ? `<img src="${escapeHtml(branding.value.header_icon_right_url)}" alt="" />` : '<div></div>'}
                </div>

                <hr />

                <div class="titulo-documento">RECETA MÉDICA</div>

                <div class="caja-titulo">
                    <div class="col-izquierda">
                        <div class="datos-paciente">
                            <div class="col-paciente">
                                <strong>Paciente:</strong> ${escapeHtml(nombrePaciente.toUpperCase())}<br />
                                <strong>${paciente.value?.cedula ? 'Céd:' : 'Pasaporte:'}</strong> ${escapeHtml(paciente.value?.cedula || paciente.value?.pasaporte)}<br />
                                <strong>Edad:</strong> ${edad}
                            </div>
                            <div class="col-ars"><strong>ARS:</strong> ${escapeHtml(ars)}</div>
                        </div>
                    </div>
                    <div class="col-derecha">
                        <div><strong>Fecha:</strong> ${formatearFechaLegible(recetaSeleccionada.fecha_emision)}</div>
                        <div><strong>Hora:</strong> ${formatearHoraLegible(recetaSeleccionada.created_at)}</div>
                    </div>
                </div>

                <div class="caja-contenido">
                    <div class="rx-row">
                        <div class="rx">℞</div>
                        <div class="rx-contenido">
                            <p>${escapeHtml(recetaSeleccionada.medicamentos)}</p>
                            ${recetaSeleccionada.indicaciones ? `<p>${escapeHtml(recetaSeleccionada.indicaciones)}</p>` : ''}
                        </div>
                    </div>
                </div>
            </body>
        </html>
    `);

    ventana.document.close();
    ventana.focus();
    ventana.print();
};

// ============ Dieta ============
const dietas = ref([]);
const visibleDietaDialog = ref(false);
const editandoDieta = ref(false);

const dietaVacia = {
    id: null,
    fecha: null,
    dieta: ''
};

const dieta = ref({ ...dietaVacia });

const cargarDietas = async () => {
    dietas.value = await funListarDietas(patientId.value);
};

const nuevaDieta = () => {
    errores.value = {};
    editandoDieta.value = false;
    dieta.value = { ...dietaVacia, fecha: new Date() };
    visibleDietaDialog.value = true;
};

const editarDieta = (dietaSeleccionada) => {
    errores.value = {};
    editandoDieta.value = true;
    dieta.value = {
        id: dietaSeleccionada.id,
        fecha: parsearFecha(dietaSeleccionada.fecha),
        dieta: dietaSeleccionada.dieta
    };
    visibleDietaDialog.value = true;
};

const guardarDieta = async () => {
    try {
        const datos = {
            patient_id: patientId.value,
            fecha: dieta.value.fecha ? formatearFecha(dieta.value.fecha) : null,
            dieta: dieta.value.dieta
        };

        if (editandoDieta.value) {
            await funActualizarDieta(dieta.value.id, datos);
        } else {
            await funGuardarDieta(datos);
        }

        toast.add({
            severity: 'success',
            summary: editandoDieta.value ? 'Dieta actualizada' : 'Dieta creada',
            detail: 'Los datos fueron guardados correctamente',
            life: 3000
        });

        visibleDietaDialog.value = false;
        await cargarDietas();
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

const eliminarDieta = (dietaSeleccionada) => {
    confirm.require({
        message: '¿Desea eliminar este plan de dieta?',
        header: 'Confirmar eliminación',
        acceptLabel: 'Eliminar',
        rejectLabel: 'Cancelar',
        acceptClass: 'p-button-danger',

        accept: async () => {
            try {
                await funEliminarDieta(dietaSeleccionada.id);
                await cargarDietas();

                toast.add({
                    severity: 'success',
                    summary: 'Dieta eliminada',
                    detail: 'El plan de dieta fue eliminado correctamente',
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

const imprimirDietaDoc = (dietaSeleccionada) => {
    const nombrePaciente = paciente.value ? `${paciente.value.first_name} ${paciente.value.last_name}` : '';
    const edad = calcularEdadDetallada(paciente.value?.birth_date, dietaSeleccionada.fecha);

    const ventana = window.open('', '_blank');

    ventana.document.write(`
        <html>
            <head>
                <title>Plan de dieta</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 2rem; color: #222; }
                    .header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
                    .header img { max-height: 90px; max-width: 110px; object-fit: contain; }
                    .header-credenciales { text-align: center; flex: 1; }
                    .header-credenciales h2 { margin: 0 0 0.25rem; font-size: 1.3rem; }
                    .header-credenciales .titulo-profesional { font-size: 0.95rem; font-style: italic; margin: 0 0 0.25rem; }
                    .header-credenciales .parrafo { font-size: 0.85rem; white-space: pre-line; line-height: 1.3; }
                    hr { border: none; border-top: 2px solid #333; margin: 1rem 0; }
                    .titulo-documento { text-align: center; font-weight: bold; font-size: 1.3rem; letter-spacing: 0.05em; margin-bottom: 1rem; }
                    .caja-titulo { border: 1px solid #333; display: flex; }
                    .col-izquierda { flex: 3; padding: 0.6rem 1rem; }
                    .col-derecha { flex: 1.1; border-left: 1px solid #333; padding: 0.75rem 1rem; }
                    .col-derecha div { margin-bottom: 0.4rem; }
                    .caja-contenido { border: 1px solid #333; border-top: none; padding: 1.5rem; min-height: 10rem; }
                    .caja-contenido p { margin: 0; white-space: pre-wrap; }
                </style>
            </head>
            <body>
                <div class="header">
                    ${branding.value.header_icon_left_url ? `<img src="${escapeHtml(branding.value.header_icon_left_url)}" alt="" />` : '<div></div>'}
                    <div class="header-credenciales">
                        <h2>${escapeHtml(branding.value.brand_name)}</h2>
                        ${branding.value.professional_title ? `<div class="titulo-profesional">${escapeHtml(branding.value.professional_title)}</div>` : ''}
                        <div class="parrafo">${escapeHtml(branding.value.header_credentials)}</div>
                    </div>
                    ${branding.value.header_icon_right_url ? `<img src="${escapeHtml(branding.value.header_icon_right_url)}" alt="" />` : '<div></div>'}
                </div>

                <hr />

                <div class="titulo-documento">PLAN DE DIETA</div>

                <div class="caja-titulo">
                    <div class="col-izquierda">
                        <strong>Paciente:</strong> ${escapeHtml(nombrePaciente.toUpperCase())}<br />
                        <strong>${paciente.value?.cedula ? 'Céd:' : 'Pasaporte:'}</strong> ${escapeHtml(paciente.value?.cedula || paciente.value?.pasaporte)}<br />
                        <strong>Edad:</strong> ${edad}
                    </div>
                    <div class="col-derecha">
                        <div><strong>Fecha:</strong> ${formatearFechaLegible(dietaSeleccionada.fecha)}</div>
                    </div>
                </div>

                <div class="caja-contenido">
                    <p>${escapeHtml(dietaSeleccionada.dieta)}</p>
                </div>
            </body>
        </html>
    `);

    ventana.document.close();
    ventana.focus();
    ventana.print();
};

// ============ Estudios médicos ============
// A diferencia de los demás documentos, esto son archivos (imagen o PDF)
// subidos por el usuario, no texto armado por la app — no hay "imprimir con
// membrete", el archivo se ve/descarga tal cual se subió.
const estudios = ref([]);
const visibleEstudioDialog = ref(false);
const editandoEstudio = ref(false);
const archivoEstudio = ref(null);
const subiendoEstudio = ref(false);

const tiposEstudio = [
    { label: 'Sonografía', value: 'sonografia' },
    { label: 'Rayos X', value: 'rayos_x' },
    { label: 'Tomografía', value: 'tomografia' },
    { label: 'Resonancia', value: 'resonancia' },
    { label: 'Análisis de laboratorio', value: 'laboratorio' },
    { label: 'Otro', value: 'otro' }
];

const estudioVacio = {
    id: null,
    tipo: null,
    fecha_estudio: null,
    descripcion: '',
    historial_medico_id: null
};

const estudio = ref({ ...estudioVacio });

const etiquetaTipoEstudio = (tipo) => tiposEstudio.find((t) => t.value === tipo)?.label ?? tipo;

const cargarEstudios = async () => {
    estudios.value = await funListarEstudios(patientId.value);
};

const nuevoEstudio = () => {
    errores.value = {};
    editandoEstudio.value = false;
    estudio.value = { ...estudioVacio, fecha_estudio: new Date() };
    archivoEstudio.value = null;
    visibleEstudioDialog.value = true;
};

const editarEstudio = (estudioSeleccionado) => {
    errores.value = {};
    editandoEstudio.value = true;
    estudio.value = {
        id: estudioSeleccionado.id,
        tipo: estudioSeleccionado.tipo,
        fecha_estudio: parsearFecha(estudioSeleccionado.fecha_estudio),
        descripcion: estudioSeleccionado.descripcion,
        historial_medico_id: estudioSeleccionado.historial_medico_id
    };
    archivoEstudio.value = null;
    visibleEstudioDialog.value = true;
};

const seleccionarArchivoEstudio = (event) => {
    archivoEstudio.value = event.files?.[0] ?? null;
};

const guardarEstudio = async () => {
    try {
        subiendoEstudio.value = true;

        if (editandoEstudio.value) {
            // Solo metadatos: para reemplazar el archivo se sube un estudio nuevo.
            await funActualizarEstudio(estudio.value.id, {
                tipo: estudio.value.tipo,
                fecha_estudio: estudio.value.fecha_estudio ? formatearFecha(estudio.value.fecha_estudio) : null,
                descripcion: estudio.value.descripcion,
                historial_medico_id: estudio.value.historial_medico_id
            });
        } else {
            if (!archivoEstudio.value) {
                toast.add({ severity: 'warn', summary: 'Falta el archivo', detail: 'Selecciona una imagen o PDF para subir', life: 3000 });
                return;
            }

            await funGuardarEstudio({
                patient_id: patientId.value,
                tipo: estudio.value.tipo,
                fecha_estudio: estudio.value.fecha_estudio ? formatearFecha(estudio.value.fecha_estudio) : null,
                descripcion: estudio.value.descripcion,
                historial_medico_id: estudio.value.historial_medico_id,
                archivo: archivoEstudio.value
            });
        }

        toast.add({
            severity: 'success',
            summary: editandoEstudio.value ? 'Estudio actualizado' : 'Estudio subido',
            detail: 'Los datos fueron guardados correctamente',
            life: 3000
        });

        visibleEstudioDialog.value = false;
        await cargarEstudios();
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
    } finally {
        subiendoEstudio.value = false;
    }
};

// Antes se abría archivo_url tal cual viniera del backend: si por error (o por un
// backend comprometido) llegara algo como "javascript:..." en vez de una URL de
// archivo, window.open lo habría ejecutado. Se valida el esquema acá, en el borde
// donde el dato deja de ser solo texto y pasa a ser una acción del navegador.
const verEstudio = (estudioSeleccionado) => {
    const url = estudioSeleccionado.archivo_url ?? '';

    if (!/^https?:\/\//i.test(url)) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: 'La URL del archivo no es válida',
            life: 3000
        });
        return;
    }

    window.open(url, '_blank');
};

const eliminarEstudio = (estudioSeleccionado) => {
    confirm.require({
        message: '¿Desea eliminar este estudio médico?',
        header: 'Confirmar eliminación',
        acceptLabel: 'Eliminar',
        rejectLabel: 'Cancelar',
        acceptClass: 'p-button-danger',

        accept: async () => {
            try {
                await funEliminarEstudio(estudioSeleccionado.id);
                await cargarEstudios();

                toast.add({
                    severity: 'success',
                    summary: 'Estudio eliminado',
                    detail: 'El estudio fue eliminado correctamente',
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

// ============ Autorización de procedimientos ============
const autorizaciones = ref([]);
const visibleAutorizacionDialog = ref(false);
const editandoAutorizacion = ref(false);

const autorizacionVacia = {
    id: null,
    fecha: null,
    ars: '',
    historia_enfermedad: '',
    estudios_realizados: '',
    tiempo_evolucion: '',
    tratamiento_previo: '',
    diagnostico_presuntivo: ''
};

const autorizacion = ref({ ...autorizacionVacia });

const cargarAutorizaciones = async () => {
    autorizaciones.value = await funListarAutorizaciones(patientId.value);
};

const nuevaAutorizacion = () => {
    errores.value = {};
    editandoAutorizacion.value = false;
    // El ARS se precarga desde la ficha del paciente, pero queda editable:
    // puede diferir o haber cambiado desde que se registró al paciente.
    autorizacion.value = { ...autorizacionVacia, fecha: new Date(), ars: paciente.value?.insurance ?? '' };
    visibleAutorizacionDialog.value = true;
};

const editarAutorizacion = (autorizacionSeleccionada) => {
    errores.value = {};
    editandoAutorizacion.value = true;
    autorizacion.value = {
        id: autorizacionSeleccionada.id,
        fecha: parsearFecha(autorizacionSeleccionada.fecha),
        ars: autorizacionSeleccionada.ars,
        historia_enfermedad: autorizacionSeleccionada.historia_enfermedad,
        estudios_realizados: autorizacionSeleccionada.estudios_realizados,
        tiempo_evolucion: autorizacionSeleccionada.tiempo_evolucion,
        tratamiento_previo: autorizacionSeleccionada.tratamiento_previo,
        diagnostico_presuntivo: autorizacionSeleccionada.diagnostico_presuntivo
    };
    visibleAutorizacionDialog.value = true;
};

const guardarAutorizacion = async () => {
    try {
        const datos = {
            patient_id: patientId.value,
            fecha: autorizacion.value.fecha ? formatearFecha(autorizacion.value.fecha) : null,
            ars: autorizacion.value.ars,
            historia_enfermedad: autorizacion.value.historia_enfermedad,
            estudios_realizados: autorizacion.value.estudios_realizados,
            tiempo_evolucion: autorizacion.value.tiempo_evolucion,
            tratamiento_previo: autorizacion.value.tratamiento_previo,
            diagnostico_presuntivo: autorizacion.value.diagnostico_presuntivo
        };

        if (editandoAutorizacion.value) {
            await funActualizarAutorizacion(autorizacion.value.id, datos);
        } else {
            await funGuardarAutorizacion(datos);
        }

        toast.add({
            severity: 'success',
            summary: editandoAutorizacion.value ? 'Autorización actualizada' : 'Autorización creada',
            detail: 'Los datos fueron guardados correctamente',
            life: 3000
        });

        visibleAutorizacionDialog.value = false;
        await cargarAutorizaciones();
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

const eliminarAutorizacion = (autorizacionSeleccionada) => {
    confirm.require({
        message: '¿Desea eliminar esta autorización de procedimientos?',
        header: 'Confirmar eliminación',
        acceptLabel: 'Eliminar',
        rejectLabel: 'Cancelar',
        acceptClass: 'p-button-danger',

        accept: async () => {
            try {
                await funEliminarAutorizacion(autorizacionSeleccionada.id);
                await cargarAutorizaciones();

                toast.add({
                    severity: 'success',
                    summary: 'Autorización eliminada',
                    detail: 'La autorización fue eliminada correctamente',
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

// Igual que parsearFecha: se arma a partir de los componentes de texto, sin
// pasar por un Date + getters locales, para no correr el día por huso horario.
const formatearFechaLegible = (fechaStr) => {
    if (!fechaStr) return '';
    const [anio, mes, dia] = fechaStr.slice(0, 10).split('-');
    return `${dia}/${mes}/${anio}`;
};

// Edad detallada (años, meses y días) a la fecha del documento, como en el
// membrete impreso de referencia: "54 año(s), 7 mes(es) y 9 día(s)".
const calcularEdadDetallada = (birthDateStr, fechaReferenciaStr) => {
    if (!birthDateStr) return '';

    const nacimiento = parsearFecha(birthDateStr);
    const referencia = fechaReferenciaStr ? parsearFecha(fechaReferenciaStr) : new Date();

    let anios = referencia.getFullYear() - nacimiento.getFullYear();
    let meses = referencia.getMonth() - nacimiento.getMonth();
    let dias = referencia.getDate() - nacimiento.getDate();

    if (dias < 0) {
        meses -= 1;
        const ultimoDiaMesAnterior = new Date(referencia.getFullYear(), referencia.getMonth(), 0);
        dias += ultimoDiaMesAnterior.getDate();
    }

    if (meses < 0) {
        anios -= 1;
        meses += 12;
    }

    return `${anios} año(s), ${meses} mes(es) y ${dias} día(s)`;
};

const imprimirAutorizacion = (autorizacionSeleccionada) => {
    const nombrePaciente = paciente.value ? `${paciente.value.first_name} ${paciente.value.last_name}` : '';
    const edad = calcularEdadDetallada(paciente.value?.birth_date, autorizacionSeleccionada.fecha);
    const ars = autorizacionSeleccionada.ars || 'No especificada';

    const ventana = window.open('', '_blank');

    ventana.document.write(`
        <html>
            <head>
                <title>Autorización de procedimientos</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 2rem; color: #222; }
                    .header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
                    .header img { max-height: 90px; max-width: 110px; object-fit: contain; }
                    .header-credenciales { text-align: center; flex: 1; }
                    .header-credenciales h2 { margin: 0 0 0.25rem; font-size: 1.3rem; }
                    .header-credenciales .titulo-profesional { font-size: 0.95rem; font-style: italic; margin: 0 0 0.25rem; }
                    .header-credenciales .parrafo { font-size: 0.85rem; white-space: pre-line; line-height: 1.3; }
                    hr { border: none; border-top: 2px solid #333; margin: 1rem 0; }
                    .caja-titulo { border: 1px solid #333; }
                    .caja-titulo .titulo { text-align: center; font-weight: bold; font-size: 1.2rem; padding: 0.75rem; letter-spacing: 0.05em; }
                    .datos-paciente { display: flex; border-top: 1px solid #333; }
                    .datos-paciente > div { padding: 0.6rem 1rem; }
                    .datos-paciente .col-paciente { flex: 2; border-right: 1px solid #333; }
                    .datos-paciente .col-ars { flex: 1.4; border-right: 1px solid #333; }
                    .datos-paciente .col-fecha { flex: 1; }
                    .caja-contenido { border: 1px solid #333; border-top: none; padding: 1.25rem; }
                    .campo { margin-bottom: 1rem; }
                    .campo label { display: block; font-weight: bold; font-size: 0.9rem; }
                    .campo p { margin: 0.2rem 0 0; white-space: pre-wrap; }
                </style>
            </head>
            <body>
                <div class="header">
                    ${branding.value.header_icon_left_url ? `<img src="${escapeHtml(branding.value.header_icon_left_url)}" alt="" />` : '<div></div>'}
                    <div class="header-credenciales">
                        <h2>${escapeHtml(branding.value.brand_name)}</h2>
                        ${branding.value.professional_title ? `<div class="titulo-profesional">${escapeHtml(branding.value.professional_title)}</div>` : ''}
                        <div class="parrafo">${escapeHtml(branding.value.header_credentials)}</div>
                    </div>
                    ${branding.value.header_icon_right_url ? `<img src="${escapeHtml(branding.value.header_icon_right_url)}" alt="" />` : '<div></div>'}
                </div>

                <hr />

                <div class="caja-titulo">
                    <div class="titulo">AUTORIZACIÓN DE PROCEDIMIENTOS</div>
                    <div class="datos-paciente">
                        <div class="col-paciente">
                            <strong>Paciente:</strong> ${escapeHtml(nombrePaciente.toUpperCase())}<br />
                            <strong>${paciente.value?.cedula ? 'Céd:' : 'Pasaporte:'}</strong> ${escapeHtml(paciente.value?.cedula || paciente.value?.pasaporte)}<br />
                            <strong>Edad:</strong> ${edad}
                        </div>
                        <div class="col-ars"><strong>ARS:</strong> ${escapeHtml(ars)}</div>
                        <div class="col-fecha"><strong>Fecha:</strong> ${formatearFechaLegible(autorizacionSeleccionada.fecha)}</div>
                    </div>
                </div>

                <div class="caja-contenido">
                    <div class="campo">
                        <label>Historia detallada de la enfermedad actual:</label>
                        <p>${escapeHtml(autorizacionSeleccionada.historia_enfermedad)}</p>
                    </div>
                    <div class="campo">
                        <label>Estudios realizados:</label>
                        <p>${escapeHtml(autorizacionSeleccionada.estudios_realizados)}</p>
                    </div>
                    <div class="campo">
                        <label>Tiempo de evolución de la enfermedad:</label>
                        <p>${escapeHtml(autorizacionSeleccionada.tiempo_evolucion)}</p>
                    </div>
                    <div class="campo">
                        <label>Tratamiento(s) Previo(s):</label>
                        <p>${escapeHtml(autorizacionSeleccionada.tratamiento_previo)}</p>
                    </div>
                    <div class="campo">
                        <label>Diagnóstico presuntivo:</label>
                        <p>${escapeHtml(autorizacionSeleccionada.diagnostico_presuntivo)}</p>
                    </div>
                </div>
            </body>
        </html>
    `);

    ventana.document.close();
    ventana.focus();
    ventana.print();
};

// ============ Licencia médica ============
const licencias = ref([]);
const visibleLicenciaDialog = ref(false);
const editandoLicencia = ref(false);

const licenciaVacia = {
    id: null,
    fecha: null,
    constatado: '',
    recomendacion: '',
    certificacion_cierre: ''
};

const licencia = ref({ ...licenciaVacia });

const cargarLicencias = async () => {
    licencias.value = await funListarLicencias(patientId.value);
};

const nuevaLicencia = () => {
    errores.value = {};
    editandoLicencia.value = false;
    licencia.value = { ...licenciaVacia, fecha: new Date() };
    visibleLicenciaDialog.value = true;
};

const editarLicencia = (licenciaSeleccionada) => {
    errores.value = {};
    editandoLicencia.value = true;
    licencia.value = {
        id: licenciaSeleccionada.id,
        fecha: parsearFecha(licenciaSeleccionada.fecha),
        constatado: licenciaSeleccionada.constatado,
        recomendacion: licenciaSeleccionada.recomendacion,
        certificacion_cierre: licenciaSeleccionada.certificacion_cierre
    };
    visibleLicenciaDialog.value = true;
};

const guardarLicencia = async () => {
    try {
        const datos = {
            patient_id: patientId.value,
            fecha: licencia.value.fecha ? formatearFecha(licencia.value.fecha) : null,
            constatado: licencia.value.constatado,
            recomendacion: licencia.value.recomendacion,
            certificacion_cierre: licencia.value.certificacion_cierre
        };

        if (editandoLicencia.value) {
            await funActualizarLicencia(licencia.value.id, datos);
        } else {
            await funGuardarLicencia(datos);
        }

        toast.add({
            severity: 'success',
            summary: editandoLicencia.value ? 'Licencia actualizada' : 'Licencia creada',
            detail: 'Los datos fueron guardados correctamente',
            life: 3000
        });

        visibleLicenciaDialog.value = false;
        await cargarLicencias();
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

const eliminarLicencia = (licenciaSeleccionada) => {
    confirm.require({
        message: '¿Desea eliminar esta licencia médica?',
        header: 'Confirmar eliminación',
        acceptLabel: 'Eliminar',
        rejectLabel: 'Cancelar',
        acceptClass: 'p-button-danger',

        accept: async () => {
            try {
                await funEliminarLicencia(licenciaSeleccionada.id);
                await cargarLicencias();

                toast.add({
                    severity: 'success',
                    summary: 'Licencia eliminada',
                    detail: 'La licencia fue eliminada correctamente',
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

const imprimirLicencia = (licenciaSeleccionada) => {
    const nombrePaciente = paciente.value ? `${paciente.value.first_name} ${paciente.value.last_name}` : '';
    const declaracion = branding.value.licencia_declaracion ?? '';

    const ventana = window.open('', '_blank');

    ventana.document.write(`
        <html>
            <head>
                <title>Licencia médica</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 2rem; color: #222; }
                    .header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
                    .header img { max-height: 90px; max-width: 110px; object-fit: contain; }
                    .header-credenciales { text-align: center; flex: 1; }
                    .header-credenciales h2 { margin: 0 0 0.25rem; font-size: 1.3rem; }
                    .header-credenciales .titulo-profesional { font-size: 0.95rem; font-style: italic; margin: 0 0 0.25rem; }
                    .header-credenciales .parrafo { font-size: 0.85rem; white-space: pre-line; line-height: 1.3; }
                    hr { border: none; border-top: 2px solid #333; margin: 1rem 0; }
                    .titulo-documento { text-align: center; font-weight: bold; font-size: 1.3rem; letter-spacing: 0.05em; margin-bottom: 1rem; }
                    .caja-secciones { border: 1px solid #333; }
                    .seccion { padding: 1rem 1.25rem; border-bottom: 1px solid #333; }
                    .seccion:last-child { border-bottom: none; }
                    .seccion p { margin: 0; white-space: pre-wrap; }
                </style>
            </head>
            <body>
                <div class="header">
                    ${branding.value.header_icon_left_url ? `<img src="${escapeHtml(branding.value.header_icon_left_url)}" alt="" />` : '<div></div>'}
                    <div class="header-credenciales">
                        <h2>${escapeHtml(branding.value.brand_name)}</h2>
                        ${branding.value.professional_title ? `<div class="titulo-profesional">${escapeHtml(branding.value.professional_title)}</div>` : ''}
                        <div class="parrafo">${escapeHtml(branding.value.header_credentials)}</div>
                    </div>
                    ${branding.value.header_icon_right_url ? `<img src="${escapeHtml(branding.value.header_icon_right_url)}" alt="" />` : '<div></div>'}
                </div>

                <hr />

                <div class="titulo-documento">LICENCIA MÉDICA</div>

                <div class="caja-secciones">
                    <div class="seccion">
                        <p>Yo: ${escapeHtml(declaracion)} CERTIFICO, haber examinado a: ${escapeHtml(nombrePaciente.toUpperCase())}, ${paciente.value?.cedula ? 'Cédula de identidad y electoral No.' : 'Pasaporte No.'} ${escapeHtml(paciente.value?.cedula || paciente.value?.pasaporte)}, TITULAR.</p>
                    </div>
                    <div class="seccion">
                        <p><strong>Y constatado:</strong> ${escapeHtml(licenciaSeleccionada.constatado)}</p>
                    </div>
                    <div class="seccion">
                        <p><strong>Por lo que recomiendo:</strong> ${escapeHtml(licenciaSeleccionada.recomendacion)}</p>
                    </div>
                    <div class="seccion">
                        <p><strong>Expido la presente certificación en:</strong> ${escapeHtml(licenciaSeleccionada.certificacion_cierre)}</p>
                    </div>
                </div>
            </body>
        </html>
    `);

    ventana.document.close();
    ventana.focus();
    ventana.print();
};

// Se usa tanto en el montaje inicial como al reaccionar a un cambio de
// patientId (ver watch más abajo): al buscar un paciente desde /historial
// (sin id), la navegación a /pacientes/:id/historial reutiliza esta misma
// instancia en vez de remontarla, así que onMounted no vuelve a dispararse.
const cargarPaciente = async () => {
    if (!patientId.value) {
        paciente.value = null;
        return;
    }

    try {
        paciente.value = await funObtenerPaciente(patientId.value);
        await Promise.all([cargarHistorial(), cargarRecetas(), cargarDietas(), cargarEstudios(), cargarAutorizaciones(), cargarLicencias()]);
    } catch (error) {
        console.error(error);

        toast.add({
            severity: 'error',
            summary: 'No autorizado',
            detail: error.response?.data?.message ?? 'No se pudo cargar la información del paciente',
            life: 3000
        });
    }
};

watch(patientId, () => {
    cargarPaciente();
});

onMounted(async () => {
    await cargarBranding();
    await cargarPaciente();
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
                        <h2 class="m-0 inline-block font-display">Historial clínico</h2>
                        <br />
                        <small class="text-surface-500">Ficha completa del paciente y sus documentos</small>
                    </span>
                </div>
            </template>

            <template #end>
                <IconField>
                    <InputIcon class="pi pi-search" />
                    <InputText v-model="busquedaCedula" placeholder="Buscar paciente por cédula o pasaporte..." autocomplete="off" @keyup.enter="buscarPorCedula()" />
                </IconField>
                <Button icon="pi pi-arrow-right" class="ml-2" @click="buscarPorCedula()" />
            </template>
        </Toolbar>

        <div v-if="paciente" class="patient-card">
            <div class="who">
                <div class="initials">{{ paciente.first_name?.[0] }}{{ paciente.last_name?.[0] }}</div>
                <div>
                    <h3>
                        {{ paciente.first_name }} {{ paciente.last_name }}
                        <span v-if="esEliminado" class="pill pill-critical ml-2">Eliminado</span>
                    </h3>
                    <p>{{ paciente.cedula ? 'CI' : 'Pasaporte' }} {{ paciente.cedula || paciente.pasaporte }}</p>
                </div>
            </div>
            <div class="meta">
                <div>
                    <span>Edad</span>
                    <b>{{ calcularEdadDetallada(paciente.birth_date) }}</b>
                </div>
                <div>
                    <span>ARS</span>
                    <b>{{ paciente.insurance || '—' }}</b>
                </div>
            </div>
        </div>

        <small v-if="esEliminado" class="text-surface-500 block mb-4"> Este paciente fue eliminado. Los datos se muestran de solo lectura: no se puede crear, editar ni eliminar nada mientras esté en este estado. </small>

        <div v-if="!paciente" class="card flex flex-col items-center gap-2 text-center" style="padding: 3rem 1.5rem">
            <i class="pi pi-search" style="font-size: 1.75rem; color: var(--ink-faint)"></i>
            <p class="m-0 font-display" style="font-size: 1.05rem">Busca un paciente para ver su historial</p>
            <small class="text-surface-500">Escribe su cédula arriba a la derecha y presiona Enter, o el botón de flecha.</small>
        </div>

        <Tabs v-if="paciente" value="consultas">
            <TabList>
                <Tab value="consultas">Consultas</Tab>
                <Tab value="recetas">Recetas</Tab>
                <Tab value="dieta">Dieta</Tab>
                <Tab value="estudios">Estudios médicos</Tab>
                <Tab value="autorizacion">Autorización seguro médico</Tab>
                <Tab value="licencia">Licencia médica</Tab>
            </TabList>

            <TabPanels>
                <!-- Historial médico -->
                <TabPanel value="consultas">
                    <div class="flex justify-end items-center gap-2 mb-3 mt-2">
                        <FloatLabel>
                            <DatePicker id="filtroFecha" v-model="filtroFecha" dateFormat="dd/mm/yy" showIcon iconDisplay="input" showButtonBar />
                            <label for="filtroFecha">Filtrar por fecha</label>
                        </FloatLabel>
                        <Button v-if="!esEliminado" label="Nueva consulta" icon="pi pi-plus" outlined @click="nuevaEntradaHistorial()" />
                    </div>

                    <div class="table-responsive">
                        <DataTable :value="historialFiltrado" paginator :rows="5" stripedRows showGridlines size="small" tableStyle="table-layout: fixed; width: 100%; min-width: 46rem" class="table-fixed-layout">
                            <Column header="Fecha" bodyClass="text-tabular">
                                <template #body="slotProps">{{ formatearFechaLegible(slotProps.data.fecha_consulta) }}</template>
                            </Column>
                            <Column field="motivo_consulta" header="Motivo"></Column>
                            <Column field="diagnostico" header="Diagnóstico"></Column>
                            <Column field="tratamiento" header="Tratamiento"></Column>
                            <Column header="Acciones" headerStyle="width: 8.5rem" bodyStyle="white-space: nowrap; width: 8.5rem">
                                <template #body="slotProps">
                                    <div class="flex gap-2">
                                        <Button v-if="!esEliminado" icon="pi pi-pencil" rounded size="small" @click="editarEntradaHistorial(slotProps.data)" />
                                        <Button icon="pi pi-print" rounded size="small" @click="imprimirHistorial(slotProps.data)" v-tooltip.top="'Imprimir historial'" />
                                        <Button v-if="esMedico && !esEliminado" icon="pi pi-trash" severity="danger" rounded size="small" @click="eliminarEntradaHistorial(slotProps.data)" />
                                    </div>
                                </template>
                            </Column>
                        </DataTable>
                    </div>
                </TabPanel>

                <!-- Recetas -->
                <TabPanel value="recetas">
                    <div class="flex justify-end mb-3 mt-2">
                        <Button v-if="!esEliminado" label="Nueva receta" icon="pi pi-plus" outlined @click="nuevaReceta()" />
                    </div>

                    <div class="table-responsive">
                        <DataTable :value="recetas" paginator :rows="5" stripedRows showGridlines size="small" tableStyle="table-layout: fixed; width: 100%; min-width: 46rem" class="table-fixed-layout">
                            <Column header="Fecha" bodyClass="text-tabular">
                                <template #body="slotProps">{{ formatearFechaLegible(slotProps.data.fecha_emision) }}</template>
                            </Column>
                            <Column field="ars" header="ARS"></Column>
                            <Column field="medicamentos" header="Medicamentos"></Column>
                            <Column field="indicaciones" header="Indicaciones"></Column>
                            <Column header="Acciones" headerStyle="width: 8.5rem" bodyStyle="white-space: nowrap; width: 8.5rem">
                                <template #body="slotProps">
                                    <div class="flex gap-2">
                                        <Button v-if="!esEliminado" icon="pi pi-pencil" rounded size="small" @click="editarReceta(slotProps.data)" />
                                        <Button icon="pi pi-print" rounded size="small" @click="imprimirReceta(slotProps.data)" v-tooltip.top="'Imprimir receta'" />
                                        <Button v-if="esMedico && !esEliminado" icon="pi pi-trash" severity="danger" rounded size="small" @click="eliminarReceta(slotProps.data)" />
                                    </div>
                                </template>
                            </Column>
                        </DataTable>
                    </div>
                </TabPanel>

                <!-- Dieta -->
                <TabPanel value="dieta">
                    <div class="flex justify-end mb-3 mt-2">
                        <Button v-if="!esEliminado" label="Nueva dieta" icon="pi pi-plus" outlined @click="nuevaDieta()" />
                    </div>

                    <div class="table-responsive">
                        <DataTable :value="dietas" paginator :rows="5" stripedRows showGridlines size="small" tableStyle="table-layout: fixed; width: 100%; min-width: 34rem" class="table-fixed-layout">
                            <Column header="Fecha" bodyClass="text-tabular">
                                <template #body="slotProps">{{ formatearFechaLegible(slotProps.data.fecha) }}</template>
                            </Column>
                            <Column field="dieta" header="Dieta indicada"></Column>
                            <Column header="Acciones" headerStyle="width: 8.5rem" bodyStyle="white-space: nowrap; width: 8.5rem">
                                <template #body="slotProps">
                                    <div class="flex gap-2">
                                        <Button v-if="!esEliminado" icon="pi pi-pencil" rounded size="small" @click="editarDieta(slotProps.data)" />
                                        <Button icon="pi pi-print" rounded size="small" @click="imprimirDietaDoc(slotProps.data)" v-tooltip.top="'Imprimir dieta'" />
                                        <Button v-if="esMedico && !esEliminado" icon="pi pi-trash" severity="danger" rounded size="small" @click="eliminarDieta(slotProps.data)" />
                                    </div>
                                </template>
                            </Column>
                        </DataTable>
                    </div>
                </TabPanel>

                <!-- Estudios médicos -->
                <TabPanel value="estudios">
                    <div class="flex justify-end mb-3 mt-2">
                        <Button v-if="!esEliminado" label="Nuevo estudio" icon="pi pi-plus" outlined @click="nuevoEstudio()" />
                    </div>

                    <div class="table-responsive">
                        <DataTable :value="estudios" paginator :rows="5" stripedRows showGridlines size="small" tableStyle="table-layout: fixed; width: 100%; min-width: 42rem" class="table-fixed-layout">
                            <Column header="Fecha" bodyClass="text-tabular">
                                <template #body="slotProps">{{ formatearFechaLegible(slotProps.data.fecha_estudio) }}</template>
                            </Column>
                            <Column header="Tipo">
                                <template #body="slotProps"
                                    ><span class="pill pill-neutral">{{ etiquetaTipoEstudio(slotProps.data.tipo) }}</span></template
                                >
                            </Column>
                            <Column field="descripcion" header="Descripción"></Column>
                            <Column header="Acciones" headerStyle="width: 8.5rem" bodyStyle="white-space: nowrap; width: 8.5rem">
                                <template #body="slotProps">
                                    <div class="flex gap-2">
                                        <Button icon="pi pi-eye" rounded size="small" @click="verEstudio(slotProps.data)" v-tooltip.top="'Ver / descargar'" />
                                        <Button v-if="!esEliminado" icon="pi pi-pencil" rounded size="small" @click="editarEstudio(slotProps.data)" />
                                        <Button v-if="esMedico && !esEliminado" icon="pi pi-trash" severity="danger" rounded size="small" @click="eliminarEstudio(slotProps.data)" />
                                    </div>
                                </template>
                            </Column>
                        </DataTable>
                    </div>
                </TabPanel>

                <!-- Autorización de procedimientos -->
                <TabPanel value="autorizacion">
                    <div class="flex justify-end mb-3 mt-2">
                        <Button v-if="!esEliminado" label="Nueva autorización" icon="pi pi-plus" outlined @click="nuevaAutorizacion()" />
                    </div>

                    <div class="table-responsive">
                        <DataTable :value="autorizaciones" paginator :rows="5" stripedRows showGridlines size="small" tableStyle="table-layout: fixed; width: 100%; min-width: 44rem" class="table-fixed-layout">
                            <Column header="Fecha" bodyClass="text-tabular">
                                <template #body="slotProps">{{ formatearFechaLegible(slotProps.data.fecha) }}</template>
                            </Column>
                            <Column field="ars" header="ARS"></Column>
                            <Column field="diagnostico_presuntivo" header="Diagnóstico presuntivo"></Column>
                            <Column header="Acciones" headerStyle="width: 8.5rem" bodyStyle="white-space: nowrap; width: 8.5rem">
                                <template #body="slotProps">
                                    <div class="flex gap-2">
                                        <Button v-if="!esEliminado" icon="pi pi-pencil" rounded size="small" @click="editarAutorizacion(slotProps.data)" />
                                        <Button icon="pi pi-print" rounded size="small" @click="imprimirAutorizacion(slotProps.data)" v-tooltip.top="'Imprimir autorización'" />
                                        <Button v-if="esMedico && !esEliminado" icon="pi pi-trash" severity="danger" rounded size="small" @click="eliminarAutorizacion(slotProps.data)" />
                                    </div>
                                </template>
                            </Column>
                        </DataTable>
                    </div>
                </TabPanel>

                <!-- Licencia médica -->
                <TabPanel value="licencia">
                    <div class="flex justify-end mb-3 mt-2">
                        <Button v-if="!esEliminado" label="Nueva licencia" icon="pi pi-plus" outlined @click="nuevaLicencia()" />
                    </div>

                    <div class="table-responsive">
                        <DataTable :value="licencias" paginator :rows="5" stripedRows showGridlines size="small" tableStyle="table-layout: fixed; width: 100%; min-width: 42rem" class="table-fixed-layout">
                            <Column header="Fecha" bodyClass="text-tabular">
                                <template #body="slotProps">{{ formatearFechaLegible(slotProps.data.fecha) }}</template>
                            </Column>
                            <Column field="constatado" header="Y constatado"></Column>
                            <Column field="recomendacion" header="Recomendación"></Column>
                            <Column header="Acciones" headerStyle="width: 8.5rem" bodyStyle="white-space: nowrap; width: 8.5rem">
                                <template #body="slotProps">
                                    <div class="flex gap-2">
                                        <Button v-if="!esEliminado" icon="pi pi-pencil" rounded size="small" @click="editarLicencia(slotProps.data)" />
                                        <Button icon="pi pi-print" rounded size="small" @click="imprimirLicencia(slotProps.data)" v-tooltip.top="'Imprimir licencia'" />
                                        <Button v-if="esMedico && !esEliminado" icon="pi pi-trash" severity="danger" rounded size="small" @click="eliminarLicencia(slotProps.data)" />
                                    </div>
                                </template>
                            </Column>
                        </DataTable>
                    </div>
                </TabPanel>
            </TabPanels>
        </Tabs>

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
                    <InputText id="ars_receta" v-model="receta.ars" class="w-full" />
                    <label for="ars_receta">ARS</label>
                </FloatLabel>
                <small v-if="errores.ars" class="text-red-500">{{ errores.ars[0] }}</small>

                <div class="flex flex-col gap-1 w-full">
                    <label for="historial_medico_id" class="text-sm text-surface-600">Consulta relacionada (opcional)</label>
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
                </div>

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

        <!-- Dialog: dieta -->
        <Dialog v-model:visible="visibleDietaDialog" :header="editandoDieta ? 'Editar dieta' : 'Nueva dieta'" :modal="true" :style="{ width: '650px' }" :breakpoints="{ '960px': '90vw' }">
            <div class="flex flex-col gap-3 pt-2">
                <FloatLabel class="w-full">
                    <DatePicker id="fecha_dieta" v-model="dieta.fecha" class="w-full" dateFormat="dd/mm/yy" showIcon iconDisplay="input" />
                    <label for="fecha_dieta">Fecha</label>
                </FloatLabel>
                <small v-if="errores.fecha" class="text-red-500">{{ errores.fecha[0] }}</small>

                <FloatLabel class="w-full">
                    <Textarea id="dieta_texto" v-model="dieta.dieta" class="w-full" rows="4" autoResize />
                    <label for="dieta_texto">Dieta indicada</label>
                </FloatLabel>
                <small v-if="errores.dieta" class="text-red-500">{{ errores.dieta[0] }}</small>
            </div>

            <template #footer>
                <Button label="Cancelar" severity="secondary" @click="visibleDietaDialog = false" />
                <Button :label="editandoDieta ? 'Actualizar' : 'Guardar'" icon="pi pi-check" @click="guardarDieta()" />
            </template>
        </Dialog>

        <!-- Dialog: estudio médico -->
        <Dialog v-model:visible="visibleEstudioDialog" :header="editandoEstudio ? 'Editar estudio' : 'Nuevo estudio médico'" :modal="true" :style="{ width: '650px' }" :breakpoints="{ '960px': '90vw' }">
            <div class="flex flex-col gap-3 pt-2">
                <div class="flex flex-col gap-1 w-full">
                    <label for="tipo_estudio" class="text-sm text-surface-600">Tipo de estudio</label>
                    <Select id="tipo_estudio" v-model="estudio.tipo" :options="tiposEstudio" optionLabel="label" optionValue="value" placeholder="Selecciona un tipo" class="w-full" />
                </div>
                <small v-if="errores.tipo" class="text-red-500">{{ errores.tipo[0] }}</small>

                <FloatLabel class="w-full">
                    <DatePicker id="fecha_estudio" v-model="estudio.fecha_estudio" class="w-full" dateFormat="dd/mm/yy" showIcon iconDisplay="input" />
                    <label for="fecha_estudio">Fecha del estudio</label>
                </FloatLabel>
                <small v-if="errores.fecha_estudio" class="text-red-500">{{ errores.fecha_estudio[0] }}</small>

                <div class="flex flex-col gap-1 w-full">
                    <label for="historial_estudio" class="text-sm text-surface-600">Consulta relacionada (opcional)</label>
                    <Select
                        id="historial_estudio"
                        v-model="estudio.historial_medico_id"
                        :options="opcionesHistorial"
                        optionLabel="label"
                        optionValue="value"
                        showClear
                        class="w-full"
                        :placeholder="opcionesHistorial.length ? 'Selecciona una consulta' : 'Este paciente aún no tiene consultas registradas'"
                        :disabled="!opcionesHistorial.length"
                    />
                </div>

                <FloatLabel class="w-full">
                    <Textarea id="descripcion_estudio" v-model="estudio.descripcion" class="w-full" rows="2" autoResize />
                    <label for="descripcion_estudio">Descripción (opcional)</label>
                </FloatLabel>

                <div v-if="!editandoEstudio" class="flex flex-col gap-2">
                    <label class="text-sm text-surface-600">Archivo (imagen o PDF, máx. 10MB)</label>
                    <FileUpload mode="basic" name="archivo" accept="image/png,image/jpeg,application/pdf" :maxFileSize="10485760" chooseLabel="Seleccionar archivo" @select="seleccionarArchivoEstudio" />
                    <small v-if="errores.archivo" class="text-red-500">{{ errores.archivo[0] }}</small>
                </div>
                <small v-else class="text-surface-500">Para reemplazar el archivo, sube un estudio nuevo.</small>
            </div>

            <template #footer>
                <Button label="Cancelar" severity="secondary" @click="visibleEstudioDialog = false" />
                <Button :label="editandoEstudio ? 'Actualizar' : 'Subir'" icon="pi pi-check" :loading="subiendoEstudio" @click="guardarEstudio()" />
            </template>
        </Dialog>

        <!-- Dialog: autorización de procedimientos -->
        <Dialog v-model:visible="visibleAutorizacionDialog" :header="editandoAutorizacion ? 'Editar autorización' : 'Nueva autorización de procedimientos'" :modal="true" :style="{ width: '650px' }" :breakpoints="{ '960px': '90vw' }">
            <div class="flex flex-col gap-3 pt-2">
                <FloatLabel class="w-full">
                    <DatePicker id="fecha_autorizacion" v-model="autorizacion.fecha" class="w-full" dateFormat="dd/mm/yy" showIcon iconDisplay="input" />
                    <label for="fecha_autorizacion">Fecha</label>
                </FloatLabel>
                <small v-if="errores.fecha" class="text-red-500">{{ errores.fecha[0] }}</small>

                <FloatLabel class="w-full">
                    <InputText id="ars" v-model="autorizacion.ars" class="w-full" />
                    <label for="ars">ARS</label>
                </FloatLabel>
                <small v-if="errores.ars" class="text-red-500">{{ errores.ars[0] }}</small>

                <FloatLabel class="w-full">
                    <Textarea id="historia_enfermedad" v-model="autorizacion.historia_enfermedad" class="w-full" rows="3" autoResize />
                    <label for="historia_enfermedad">Historia detallada de la enfermedad actual</label>
                </FloatLabel>
                <small v-if="errores.historia_enfermedad" class="text-red-500">{{ errores.historia_enfermedad[0] }}</small>

                <FloatLabel class="w-full">
                    <Textarea id="estudios_realizados" v-model="autorizacion.estudios_realizados" class="w-full" rows="2" autoResize />
                    <label for="estudios_realizados">Estudios realizados</label>
                </FloatLabel>

                <FloatLabel class="w-full">
                    <Textarea id="tiempo_evolucion" v-model="autorizacion.tiempo_evolucion" class="w-full" rows="1" autoResize />
                    <label for="tiempo_evolucion">Tiempo de evolución de la enfermedad</label>
                </FloatLabel>

                <FloatLabel class="w-full">
                    <Textarea id="tratamiento_previo" v-model="autorizacion.tratamiento_previo" class="w-full" rows="2" autoResize />
                    <label for="tratamiento_previo">Tratamiento(s) previo(s)</label>
                </FloatLabel>

                <FloatLabel class="w-full">
                    <Textarea id="diagnostico_presuntivo" v-model="autorizacion.diagnostico_presuntivo" class="w-full" rows="3" autoResize />
                    <label for="diagnostico_presuntivo">Diagnóstico presuntivo</label>
                </FloatLabel>
                <small v-if="errores.diagnostico_presuntivo" class="text-red-500">{{ errores.diagnostico_presuntivo[0] }}</small>
            </div>

            <template #footer>
                <Button label="Cancelar" severity="secondary" @click="visibleAutorizacionDialog = false" />
                <Button :label="editandoAutorizacion ? 'Actualizar' : 'Guardar'" icon="pi pi-check" @click="guardarAutorizacion()" />
            </template>
        </Dialog>

        <!-- Dialog: licencia médica -->
        <Dialog v-model:visible="visibleLicenciaDialog" :header="editandoLicencia ? 'Editar licencia' : 'Nueva licencia médica'" :modal="true" :style="{ width: '650px' }" :breakpoints="{ '960px': '90vw' }">
            <div class="flex flex-col gap-3 pt-2">
                <FloatLabel class="w-full">
                    <DatePicker id="fecha_licencia" v-model="licencia.fecha" class="w-full" dateFormat="dd/mm/yy" showIcon iconDisplay="input" />
                    <label for="fecha_licencia">Fecha</label>
                </FloatLabel>
                <small v-if="errores.fecha" class="text-red-500">{{ errores.fecha[0] }}</small>

                <div class="flex flex-col gap-1 w-full">
                    <label class="text-sm text-surface-600">Declaración (vista previa)</label>
                    <div class="w-full border border-surface-300 dark:border-surface-600 rounded-border p-3 text-sm leading-relaxed">
                        <span>Yo: </span>
                        <span class="text-pink-500 dark:text-pink-400">{{ branding.licencia_declaracion || '(sin credenciales de licencia configuradas para este médico)' }}</span>
                        <span> CERTIFICO, haber examinado a: </span>
                        <span class="text-green-600 dark:text-green-400">{{ paciente ? `${paciente.first_name} ${paciente.last_name}`.toUpperCase() : '' }}</span>
                        <span>, {{ paciente?.cedula ? 'Cédula de identidad y electoral No.' : 'Pasaporte No.' }} </span>
                        <span class="text-green-600 dark:text-green-400">{{ paciente?.cedula || paciente?.pasaporte }}</span>
                        <span>, TITULAR.</span>
                    </div>
                </div>

                <FloatLabel class="w-full">
                    <Textarea id="constatado" v-model="licencia.constatado" class="w-full" rows="3" autoResize />
                    <label for="constatado">Y constatado</label>
                </FloatLabel>
                <small v-if="errores.constatado" class="text-red-500">{{ errores.constatado[0] }}</small>

                <FloatLabel class="w-full">
                    <Textarea id="recomendacion" v-model="licencia.recomendacion" class="w-full" rows="3" autoResize />
                    <label for="recomendacion">Por lo que recomiendo</label>
                </FloatLabel>
                <small v-if="errores.recomendacion" class="text-red-500">{{ errores.recomendacion[0] }}</small>

                <div class="flex flex-col gap-1 w-full">
                    <label for="certificacion_cierre" class="text-sm text-surface-600">Expido la presente certificación en: (ciudad y fecha)</label>
                    <Textarea id="certificacion_cierre" v-model="licencia.certificacion_cierre" class="w-full" rows="2" autoResize placeholder="[ciudad] a partir de hoy día [día] del mes de [mes] del año [año]" />
                </div>
                <small v-if="errores.certificacion_cierre" class="text-red-500">{{ errores.certificacion_cierre[0] }}</small>
            </div>

            <template #footer>
                <Button label="Cancelar" severity="secondary" @click="visibleLicenciaDialog = false" />
                <Button :label="editandoLicencia ? 'Actualizar' : 'Guardar'" icon="pi pi-check" @click="guardarLicencia()" />
            </template>
        </Dialog>
    </div>
</template>
