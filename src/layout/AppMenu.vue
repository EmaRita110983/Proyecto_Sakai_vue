<script setup>
import { ref } from 'vue';
import AppMenuItem from './AppMenuItem.vue';
import { hasRole } from '@/service/auth.service';

const model = ref([
    {
        label: 'Home',
        items: [
            {
                label: 'Dashboard',
                icon: 'pi pi-fw pi-home',
                to: '/'
            }
        ]
    },

    {
        label: 'Administración',
        visible: hasRole('superadmin') || hasRole('admin') || hasRole('secretaria'),
        items: [
            {
                label: hasRole('admin') ? 'Secretaria' : 'Usuarios',
                icon: 'pi pi-fw pi-users',
                to: '/usuarios',
                visible: hasRole('superadmin') || hasRole('admin')
            },
            {
                label: 'Pacientes',
                icon: 'pi pi-fw pi-id-card',
                to: '/pacientes',
                visible: hasRole('superadmin') || hasRole('admin') || hasRole('secretaria')
            },
            {
                label: 'Historial clínico',
                icon: 'pi pi-fw pi-book',
                to: '/historial',
                visible: hasRole('superadmin') || hasRole('admin')
            },
            {
                label: 'Nueva cita',
                icon: 'pi pi-fw pi-calendar-plus',
                to: { path: '/', query: { accion: 'nueva-cita' } },
                visible: hasRole('admin') || hasRole('secretaria')
            }
        ]
    },

    {
        label: 'Cuenta',
        visible: !hasRole('admin'),
        items: [
            {
                label: 'Mi Perfil',
                icon: 'pi pi-fw pi-user',
                to: '/perfil'
            }
        ]
    }
]);
</script>

<template>
    <ul class="layout-menu">
        <template v-for="(item, i) in model" :key="item">
            <app-menu-item v-if="!item.separator" :item="item" :index="i"></app-menu-item>
            <li v-if="item.separator" class="menu-separator"></li>
        </template>
    </ul>
</template>

<style lang="scss" scoped></style>
