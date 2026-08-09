<script setup>
import { computed, onMounted, ref } from 'vue';
import { funListar, funGuardar, funModificar, funCambiarEstado } from '@/service/usuario.service';
import Toast from 'primevue/toast';
import Toolbar from 'primevue/toolbar';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import Dialog from 'primevue/dialog';
import FloatLabel from 'primevue/floatlabel';
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
const usuarioActual = JSON.parse(localStorage.getItem('user'));
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

const filters = ref({
    global: {
        value: null,
        matchMode: FilterMatchMode.CONTAINS
    }
});

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
        await funGuardar(usuario.value);

        toast.add({
            severity: 'success',
            summary: 'Usuario creado',
            detail: 'El usuario fue registrado correctamente',
            life: 3000
        });

        visibleDialog.value = false;

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
                    <h2 class="m-0">Gestión de Usuarios</h2>
                    <small class="text-surface-500"> Administración de los usuarios del sistema. </small>
                </div>
            </template>

            <template #end>
                <Button label="Nuevo Usuario" icon="pi pi-user-plus" @click="nuevoUsuario()" />
            </template>
        </Toolbar>

        <div class="flex justify-end mb-4">
            <IconField>
                <InputIcon class="pi pi-search" />
                <InputText v-model="filters.global.value" placeholder="Buscar por cédula..." autocomplete="off" />
            </IconField>
        </div>

        <DataTable :value="usuarios" v-model:filters="filters" filterDisplay="menu" :globalFilterFields="['cedula']" paginator :rows="10" stripedRows showGridlines responsiveLayout="scroll">
            <Column field="id" header="ID"></Column>
            <Column field="name" header="Nombre"></Column>
            <Column field="email" header="Email"></Column>
            <Column field="cedula" header="Cédula"></Column>
            <Column field="role" header="Rol"></Column>
            <Column header="Estado">
                <template #body="slotProps">
                    <span v-if="slotProps.data.status">Activo</span>
                    <span v-else>Inactivo</span>
                </template>
            </Column>
            <Column header="Acciones">
    <template #body="slotProps">
        <div class="flex gap-2">
            <Button icon="pi pi-pencil" severity="info" rounded @click="editarUsuario(slotProps.data)" />
            <Button v-if="slotProps.data.status" icon="pi pi-ban" severity="danger" rounded @click="desactivarUsuario(slotProps.data)" />
            <Button v-else icon="pi pi-check" severity="success" rounded @click="activarUsuario(slotProps.data)" />
        </div>
    </template>
</Column>

        </DataTable>

        <Dialog v-model:visible="visibleDialog" :header="editando ? 'Editar Usuario' : 'Nuevo Usuario'" :modal="true" :style="{ width: '450px' }">
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

                <FloatLabel>
                    <InputText id="password" v-model="usuario.password" />
                    <label for="password">Password</label>
                </FloatLabel>
                <small v-if="errores.password" class="text-red-500">
                    {{ errores.password[0] }}
                </small>
            </div>

            <template #footer>
                <Button label="Cancelar" severity="secondary" @click="visibleDialog = false" />

                <Button :label="editando ? 'Actualizar' : 'Guardar'" icon="pi pi-check" @click="editando ? actualizarUsuario() : guardarUsuario()" />
            </template>
        </Dialog>
    </div>
</template>
