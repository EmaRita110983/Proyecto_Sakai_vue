<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { funListar, funGuardar, funModificar, funCambiarEstado, funEliminar, funBuscarUsuarioEliminado } from '@/service/usuario.service';
import { funObtenerBrandingUsuario, funActualizarBrandingUsuario, funSubirLogoUsuario, funSubirHeaderIconoUsuario } from '@/service/tenant.service';
import { usuariosFilterResetSignal } from '@/composables/useUsuariosFilter';
import Toast from 'primevue/toast';
import Toolbar from 'primevue/toolbar';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import Dialog from 'primevue/dialog';
import FloatLabel from 'primevue/floatlabel';
import FileUpload from 'primevue/fileupload';
import Textarea from 'primevue/textarea';
import { FilterMatchMode } from '@primevue/core/api';
import { useToast } from 'primevue/usetoast';
import ConfirmDialog from 'primevue/confirmdialog';
import { useConfirm } from 'primevue/useconfirm';
import Select from 'primevue/select';

const toast = useToast();
const confirm = useConfirm();
const errores = ref({});
const visibleDialog = ref(false);
const editando = ref(false);

const usuarios = ref([]);
const usuarioActual = JSON.parse(sessionStorage.getItem('user'));
const esSuperAdmin = usuarioActual?.role === 'superadmin';

const usuario = ref({
    id: null,
    name: '',
    email: '',
    cedula: '',
    password: '',
    role: '',
    admin_id: null
});

// Médicos disponibles para asignar como tenant de una nueva secretaria
// (solo el superadmin necesita elegir esto; el admin siempre crea para sí mismo).
const medicos = computed(() => usuarios.value.filter((u) => u.role === 'admin').map((u) => ({ name: u.name, value: u.id })));

const mostrarSelectorMedico = computed(() => !editando.value && esSuperAdmin && usuario.value.role === 'secretaria');

// El admin solo gestiona sus propias secretarias desde esta pantalla (siempre
// crea para sí mismo, ver comentario de `medicos` arriba); el Superadmin
// gestiona usuarios de cualquier rol, así que mantiene el texto genérico.
const tituloGestion = esSuperAdmin ? 'Gestión de Usuarios' : 'Gestión de Secretarias';
const subtituloGestion = esSuperAdmin ? 'Administración de los usuarios del sistema.' : 'Administración de las secretarias de tu consultorio.';
const labelNuevo = esSuperAdmin ? 'Nuevo Usuario' : 'Nueva Secretaria';

const filters = ref({
    global: {
        value: null,
        matchMode: FilterMatchMode.CONTAINS
    }
});

// Ver useUsuariosFilter.js: un clic en "Usuarios"/"Secretaria" del sidebar
// mientras ya se está en esta pantalla no navega (Vue Router no dispara nada
// al ser la misma ruta), así que esta señal es la única forma de enterarse
// de que hay que limpiar el filtro y volver a mostrar todos los usuarios.
watch(usuariosFilterResetSignal, () => {
    filters.value.global.value = null;
});

// ============ Buscar usuario eliminado (soft delete) ============
// El filtro de arriba solo busca entre los usuarios activos (los eliminados
// no vienen en `usuarios`). Si no hay ninguno activo que coincida, se
// consulta al backend por si la cédula pertenece a una secretaria/médico
// eliminado, para poder consultarlo (de solo lectura, no se reactiva acá).
const usuarioEliminadoEncontrado = ref(null);

const usuariosVisibles = computed(() => (usuarioEliminadoEncontrado.value ? [...usuarios.value, usuarioEliminadoEncontrado.value] : usuarios.value));

watch(
    () => filters.value.global.value,
    () => {
        usuarioEliminadoEncontrado.value = null;
    }
);

const buscarUsuario = async () => {
    const termino = (filters.value.global.value || '').trim();

    if (!termino) {
        return;
    }

    const hayActivoCoincidente = usuarios.value.some((u) => u.cedula === termino);

    if (hayActivoCoincidente) {
        return;
    }

    try {
        const encontrado = await funBuscarUsuarioEliminado(termino);
        usuarioEliminadoEncontrado.value = { ...encontrado, eliminado: true };
    } catch (error) {
        if (error.response?.status !== 404) {
            console.error(error);
        }
    }
};

const actualizarUsuario = async () => {
    try {
        const datosActualizar = {
            name: usuario.value.name,
            email: usuario.value.email,
            cedula: usuario.value.cedula,
            role: usuario.value.role
        };

        if (usuario.value.password) {
            datosActualizar.password = usuario.value.password;
        }

        console.log('Datos enviados:', datosActualizar);

        await funModificar(usuario.value.id, datosActualizar);

        toast.add({
            severity: 'success',
            summary: 'Usuario actualizado',
            detail: 'Los datos fueron actualizados correctamente',
            life: 3000
        });

        visibleDialog.value = false;

        usuarios.value = await funListar();

        usuario.value = {
            id: null,
            name: '',
            email: '',
            cedula: '',
            password: ''
        };
    } catch (error) {
        if (error.response?.status === 422) {
            errores.value = error.response.data.errors;
        } else {
            console.error(error);
        }
    }
};

const desactivarUsuario = (usuario) => {
    confirm.require({
        message: `¿Desea desactivar al usuario ${usuario.name}?`,
        header: 'Confirmar desactivación',

        acceptLabel: 'Desactivar',
        rejectLabel: 'Cancelar',

        accept: async () => {
            try {
                await funCambiarEstado(usuario.id);

                usuarios.value = await funListar();

                toast.add({
                    severity: 'success',
                    summary: 'Usuario desactivado',
                    detail: 'El usuario fue desactivado correctamente',
                    life: 3000
                });
            } catch (error) {
                if (error.response?.status === 422) {
                    errores.value = error.response.data.errors;
                } else {
                    console.error(error);
                }
            }
        }
    });
};

const eliminarUsuario = (usuario) => {
    confirm.require({
        message: `¿Desea eliminar permanentemente al usuario ${usuario.name}? Esta acción no se puede deshacer.`,
        header: 'Confirmar eliminación',

        acceptLabel: 'Eliminar',
        rejectLabel: 'Cancelar',
        acceptProps: { severity: 'danger' },

        accept: async () => {
            try {
                await funEliminar(usuario.id);

                usuarios.value = await funListar();

                toast.add({
                    severity: 'success',
                    summary: 'Usuario eliminado',
                    detail: 'El usuario fue eliminado correctamente',
                    life: 3000
                });
            } catch (error) {
                if (error.response?.status === 403) {
                    toast.add({
                        severity: 'warn',
                        summary: 'No autorizado',
                        detail: error.response.data.message ?? 'No puede eliminar este usuario',
                        life: 3000
                    });
                } else {
                    console.error(error);
                }
            }
        }
    });
};

const credencialesDialogVisible = ref(false);
const credencialesGeneradas = ref({ email: '', password: '' });

const copiarCredenciales = async () => {
    const texto = `Email: ${credencialesGeneradas.value.email}\nPassword: ${credencialesGeneradas.value.password}`;

    try {
        await navigator.clipboard.writeText(texto);

        toast.add({
            severity: 'success',
            summary: 'Copiado',
            detail: 'Las credenciales se copiaron al portapapeles',
            life: 2500
        });
    } catch (error) {
        console.error(error);

        toast.add({
            severity: 'error',
            summary: 'No se pudo copiar',
            detail: 'Copia las credenciales manualmente',
            life: 3000
        });
    }
};

const brandingDialogVisible = ref(false);
const guardandoBranding = ref(false);
const subiendoLogo = ref(false);
const subiendoIconoIzquierdo = ref(false);
const subiendoIconoDerecho = ref(false);
const medicoBranding = ref(null);

const brandingForm = ref({
    brand_name: '',
    header_credentials: '',
    licencia_declaracion: '',
    logo_url: null,
    header_icon_left_url: null,
    header_icon_right_url: null
});

const abrirBranding = async (usuarioSeleccionado) => {
    medicoBranding.value = usuarioSeleccionado;
    brandingDialogVisible.value = true;

    try {
        const data = await funObtenerBrandingUsuario(usuarioSeleccionado.id);

        brandingForm.value = {
            brand_name: data.brand_name ?? '',
            header_credentials: data.header_credentials ?? '',
            licencia_declaracion: data.licencia_declaracion ?? '',
            logo_url: data.logo_url,
            header_icon_left_url: data.header_icon_left_url,
            header_icon_right_url: data.header_icon_right_url
        };
    } catch (error) {
        console.error(error);
    }
};

const guardarBrandingUsuario = async () => {
    guardandoBranding.value = true;

    try {
        await funActualizarBrandingUsuario(medicoBranding.value.id, {
            brand_name: brandingForm.value.brand_name,
            header_credentials: brandingForm.value.header_credentials,
            licencia_declaracion: brandingForm.value.licencia_declaracion
        });

        toast.add({
            severity: 'success',
            summary: 'Marca actualizada',
            detail: `El nombre y las credenciales de ${medicoBranding.value.name} se actualizaron correctamente`,
            life: 3000
        });
    } catch (error) {
        console.error(error);

        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo actualizar la marca',
            life: 3000
        });
    } finally {
        guardandoBranding.value = false;
    }
};

const subirLogoUsuario = async (event) => {
    const archivo = event.files?.[0];

    if (!archivo) return;

    subiendoLogo.value = true;

    try {
        const data = await funSubirLogoUsuario(medicoBranding.value.id, archivo);

        brandingForm.value.logo_url = data.logo_url;

        toast.add({
            severity: 'success',
            summary: 'Logo actualizado',
            detail: `El logo de ${medicoBranding.value.name} se actualizó correctamente`,
            life: 3000
        });
    } catch (error) {
        console.error(error);

        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo subir el logo',
            life: 3000
        });
    } finally {
        subiendoLogo.value = false;
    }
};

const subirIconoHeader = async (lado, event) => {
    const archivo = event.files?.[0];

    if (!archivo) return;

    const cargando = lado === 'left' ? subiendoIconoIzquierdo : subiendoIconoDerecho;
    cargando.value = true;

    try {
        const data = await funSubirHeaderIconoUsuario(medicoBranding.value.id, lado, archivo);

        if (lado === 'left') {
            brandingForm.value.header_icon_left_url = data.header_icon_left_url;
        } else {
            brandingForm.value.header_icon_right_url = data.header_icon_right_url;
        }

        toast.add({
            severity: 'success',
            summary: 'Ícono actualizado',
            detail: `El ícono ${lado === 'left' ? 'izquierdo' : 'derecho'} de ${medicoBranding.value.name} se actualizó correctamente`,
            life: 3000
        });
    } catch (error) {
        console.error(error);

        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo subir el ícono',
            life: 3000
        });
    } finally {
        cargando.value = false;
    }
};

const activarUsuario = async (usuario) => {
    try {
        await funCambiarEstado(usuario.id);

        usuarios.value = await funListar();

        toast.add({
            severity: 'success',
            summary: 'Usuario activado',
            detail: 'El usuario fue activado correctamente',
            life: 3000
        });
    } catch (error) {
        console.error(error);
    }
};

const editarUsuario = (usuarioSeleccionado) => {
    errores.value = {};
    editando.value = true;

    usuario.value = {
        id: usuarioSeleccionado.id,
        name: usuarioSeleccionado.name,
        email: usuarioSeleccionado.email,
        cedula: usuarioSeleccionado.cedula,
        role: usuarioSeleccionado.role,
        password: ''
    };

    visibleDialog.value = true;
};

const nuevoUsuario = () => {
    errores.value = {};
    editando.value = false;

    usuario.value = {
        id: null,
        name: '',
        email: '',
        cedula: '',
        password: '',
        role: 'secretaria',
        admin_id: null
    };

    visibleDialog.value = true;
};

// Función para guardar usuario
const guardarUsuario = async () => {
    try {
        const data = await funGuardar(usuario.value);

        toast.add({
            severity: 'success',
            summary: 'Usuario creado',
            detail: 'El usuario fue registrado correctamente',
            life: 3000
        });

        visibleDialog.value = false;

        // Solo viene presente al crear un médico (ver UserController::store):
        // el password real nunca se guarda en la BD, así que este es el único
        // momento donde el superadmin puede verlo para entregárselo.
        if (data.password_generica) {
            credencialesGeneradas.value = {
                email: data.usuario.email,
                password: data.password_generica
            };
            credencialesDialogVisible.value = true;
        }

        usuarios.value = await funListar();

        usuario.value = {
            id: null,
            name: '',
            email: '',
            cedula: '',
            password: '',
            role: '',
            admin_id: null
        };
    } catch (error) {
        console.error(error);

        if (error.response?.status === 422) {
            errores.value = error.response.data.errors;

            toast.add({
                severity: 'warn',
                summary: 'Datos inválidos',
                detail: error.response.data.message,
                life: 3000
            });

            console.log(error.response.data);
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

// El admin (médico) solo puede crear/asignar secretarias; superadmin ve las 3 opciones.
const roles = ref(
    esSuperAdmin
        ? [
              {
                  name: 'Super Administrador',
                  value: 'superadmin'
              },
              {
                  name: 'Administrador',
                  value: 'admin'
              },
              {
                  name: 'Secretaria',
                  value: 'secretaria'
              }
          ]
        : [
              {
                  name: 'Secretaria',
                  value: 'secretaria'
              }
          ]
);

onMounted(async () => {
    try {
        usuarios.value = await funListar();
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
                    <h2 class="m-0 font-display">{{ tituloGestion }}</h2>
                    <small class="text-surface-500"> {{ subtituloGestion }} </small>
                </div>
            </template>

            <template #end>
                <Button :label="labelNuevo" icon="pi pi-user-plus" @click="nuevoUsuario()" />
            </template>
        </Toolbar>

        <div class="flex justify-end mb-4">
            <IconField>
                <InputIcon class="pi pi-search" />
                <InputText v-model="filters.global.value" placeholder="Buscar por cédula..." autocomplete="off" @keyup.enter="buscarUsuario()" />
            </IconField>
            <Button icon="pi pi-arrow-right" class="ml-2" @click="buscarUsuario()" />
        </div>

        <DataTable :value="usuariosVisibles" v-model:filters="filters" filterDisplay="menu" :globalFilterFields="['cedula']" paginator :rows="10" stripedRows showGridlines responsiveLayout="scroll" size="small">
            <Column field="id" header="ID"></Column>
            <Column field="name" header="Nombre"></Column>
            <Column field="email" header="Email"></Column>
            <Column field="cedula" header="Cédula" bodyClass="text-tabular"></Column>
            <Column header="Rol">
                <template #body="slotProps">
                    <span class="pill pill-neutral">{{ slotProps.data.role }}</span>
                </template>
            </Column>
            <Column header="Estado">
                <template #body="slotProps">
                    <span v-if="slotProps.data.eliminado" class="pill pill-critical">Eliminado</span>
                    <span v-else-if="slotProps.data.status" class="pill pill-good">Activo</span>
                    <span v-else class="pill pill-critical">Inactivo</span>
                </template>
            </Column>
            <Column header="Acciones" bodyStyle="white-space: nowrap">
    <template #body="slotProps">
        <div v-if="!slotProps.data.eliminado" class="flex gap-2">
            <Button icon="pi pi-pencil" rounded size="small" @click="editarUsuario(slotProps.data)" />
            <Button v-if="slotProps.data.status" icon="pi pi-ban" severity="danger" rounded size="small" @click="desactivarUsuario(slotProps.data)" />
            <Button v-else icon="pi pi-check" severity="success" rounded size="small" @click="activarUsuario(slotProps.data)" />
            <Button icon="pi pi-trash" severity="danger" rounded outlined size="small" @click="eliminarUsuario(slotProps.data)" />
            <Button v-if="esSuperAdmin && slotProps.data.role === 'admin'" icon="pi pi-palette" rounded outlined size="small" @click="abrirBranding(slotProps.data)" />
        </div>
    </template>
</Column>

            <template #empty>
                <span v-if="filters.global.value">Cédula inválida. Coloque una cédula válida.</span>
                <span v-else>No hay {{ esSuperAdmin ? 'usuarios' : 'secretarias' }} registrados.</span>
            </template>
        </DataTable>

        <Dialog v-model:visible="visibleDialog" :header="editando ? 'Editar Usuario' : 'Nuevo Usuario'" :modal="true" :style="{ width: '450px' }" :breakpoints="{ '576px': '90vw' }">
            <div class="flex flex-col gap-3">
                <FloatLabel>
                    <InputText id="name" v-model="usuario.name" />
                    <label for="name">Nombre</label>
                </FloatLabel>

                <small v-if="errores.name" class="text-red-500">
                    {{ errores.name[0] }}
                </small>

                <FloatLabel>
                    <InputText id="email" v-model="usuario.email" />
                    <label for="email">Email</label>
                </FloatLabel>
                <small v-if="errores.email" class="text-red-500">
                    {{ errores.email[0] }}
                </small>

                <FloatLabel>
                    <InputText id="cedula" v-model="usuario.cedula" />
                    <label for="cedula">Cédula</label>
                </FloatLabel>
                <small v-if="errores.cedula" class="text-red-500">
                    {{ errores.cedula[0] }}
                </small>
                <FloatLabel>
                    <Select id="role" v-model="usuario.role" :options="roles" optionLabel="name" optionValue="value" class="w-full" />
                    <label for="role"> Rol </label>
                </FloatLabel>

                <template v-if="mostrarSelectorMedico">
                    <FloatLabel>
                        <Select id="admin_id" v-model="usuario.admin_id" :options="medicos" optionLabel="name" optionValue="value" class="w-full" />
                        <label for="admin_id">Médico al que pertenece</label>
                    </FloatLabel>
                    <small v-if="errores.admin_id" class="text-red-500">{{ errores.admin_id[0] }}</small>
                </template>

                <template v-if="editando || usuario.role !== 'admin'">
                    <FloatLabel>
                        <InputText id="password" v-model="usuario.password" />
                        <label for="password">Password</label>
                    </FloatLabel>
                    <small v-if="errores.password" class="text-red-500">
                        {{ errores.password[0] }}
                    </small>
                </template>
                <small v-else class="text-surface-500"> Se le asignará una contraseña genérica. El médico deberá cambiarla obligatoriamente en su primer inicio de sesión. </small>
            </div>

            <template #footer>
                <Button label="Cancelar" severity="secondary" @click="visibleDialog = false" />

                <Button :label="editando ? 'Actualizar' : 'Guardar'" icon="pi pi-check" @click="editando ? actualizarUsuario() : guardarUsuario()" />
            </template>
        </Dialog>

        <Dialog v-model:visible="credencialesDialogVisible" header="Credenciales del médico" :modal="true" :closable="false" :style="{ width: '450px' }" :breakpoints="{ '576px': '90vw' }">
            <div class="flex flex-col gap-3">
                <small class="text-surface-500"> Entrégale estos datos al médico. Deberá cambiar la contraseña obligatoriamente en su primer inicio de sesión. </small>

                <div class="flex flex-col gap-1">
                    <span class="text-sm font-semibold">Email</span>
                    <span class="text-tabular">{{ credencialesGeneradas.email }}</span>
                </div>

                <div class="flex flex-col gap-1">
                    <span class="text-sm font-semibold">Password</span>
                    <span class="text-tabular">{{ credencialesGeneradas.password }}</span>
                </div>
            </div>

            <template #footer>
                <Button label="Copiar" icon="pi pi-copy" severity="secondary" @click="copiarCredenciales" />
                <Button label="Entendido" icon="pi pi-check" @click="credencialesDialogVisible = false" />
            </template>
        </Dialog>

        <Dialog v-model:visible="brandingDialogVisible" :header="`Marca de ${medicoBranding?.name ?? ''}`" :modal="true" :style="{ width: '600px' }" :breakpoints="{ '960px': '90vw' }">
            <div class="flex flex-col gap-4">
                <small class="text-surface-500"> Nombre, logo, íconos y credenciales que verán este médico y sus secretarias en la app, y que se imprimen en el encabezado de los documentos (autorizaciones, etc). </small>

                <FloatLabel>
                    <InputText id="brand_name" v-model="brandingForm.brand_name" class="w-full" />
                    <label for="brand_name">Nombre del médico (título del encabezado)</label>
                </FloatLabel>

                <FloatLabel class="w-full">
                    <Textarea id="header_credentials" v-model="brandingForm.header_credentials" class="w-full" rows="4" autoResize />
                    <label for="header_credentials">Credenciales (especialidad, teléfonos, email, dirección)</label>
                </FloatLabel>
                <small class="text-surface-500"> Este texto va debajo del nombre, en el centro del encabezado de los documentos. Escribe cada dato en una línea. </small>

                <FloatLabel class="w-full">
                    <Textarea id="licencia_declaracion" v-model="brandingForm.licencia_declaracion" class="w-full" rows="3" autoResize />
                    <label for="licencia_declaracion">Declaración (Licencia Médica)</label>
                </FloatLabel>
                <small class="text-surface-500">
                    Texto fijo que abre la Licencia Médica, ej: "Yo: Dra. Fulana de Tal Médico provisto del correspondiente exequátur No. 260-02 y Cédula de identidad y electoral No. 000-0000000-0 CERTIFICO, haber examinado a:". La app le agrega el
                    nombre y cédula del paciente y ", TITULAR." automáticamente.
                </small>

                <small class="text-surface-500"> El color principal ya no se asigna aquí: cada médico lo elige desde la paleta de colores de la app (panel de configuración, arriba a la derecha). </small>

                <div class="flex flex-col gap-2">
                    <label class="text-sm font-semibold">Logo (topbar de la aplicación)</label>
                    <div class="flex items-center gap-4 flex-wrap">
                        <img v-if="brandingForm.logo_url" :src="brandingForm.logo_url" alt="Logo actual" style="height: 3rem; width: auto" />

                        <FileUpload
                            mode="basic"
                            name="logo"
                            accept="image/png,image/jpeg"
                            :maxFileSize="2000000"
                            :auto="true"
                            chooseLabel="Cambiar logo"
                            :customUpload="true"
                            @uploader="subirLogoUsuario"
                            :disabled="subiendoLogo"
                        />
                    </div>
                </div>

                <div class="flex flex-col gap-2">
                    <label class="text-sm font-semibold">Ícono izquierdo del encabezado (documentos)</label>
                    <div class="flex items-center gap-4 flex-wrap">
                        <img v-if="brandingForm.header_icon_left_url" :src="brandingForm.header_icon_left_url" alt="Ícono izquierdo actual" style="height: 3rem; width: auto" />

                        <FileUpload
                            mode="basic"
                            name="icon"
                            accept="image/png,image/jpeg"
                            :maxFileSize="2000000"
                            :auto="true"
                            chooseLabel="Cambiar ícono izquierdo"
                            :customUpload="true"
                            @uploader="(e) => subirIconoHeader('left', e)"
                            :disabled="subiendoIconoIzquierdo"
                        />
                    </div>
                </div>

                <div class="flex flex-col gap-2">
                    <label class="text-sm font-semibold">Ícono derecho del encabezado (documentos)</label>
                    <div class="flex items-center gap-4 flex-wrap">
                        <img v-if="brandingForm.header_icon_right_url" :src="brandingForm.header_icon_right_url" alt="Ícono derecho actual" style="height: 3rem; width: auto" />

                        <FileUpload
                            mode="basic"
                            name="icon"
                            accept="image/png,image/jpeg"
                            :maxFileSize="2000000"
                            :auto="true"
                            chooseLabel="Cambiar ícono derecho"
                            :customUpload="true"
                            @uploader="(e) => subirIconoHeader('right', e)"
                            :disabled="subiendoIconoDerecho"
                        />
                    </div>
                </div>
            </div>

            <template #footer>
                <Button label="Cerrar" severity="secondary" @click="brandingDialogVisible = false" />
                <Button label="Guardar nombre y credenciales" icon="pi pi-check" :loading="guardandoBranding" @click="guardarBrandingUsuario" />
            </template>
        </Dialog>
    </div>
</template>
