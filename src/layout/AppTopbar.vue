<script setup>
console.log('AppTopbar cargado');

import { useLayout } from '@/layout/composables/layout';
import AppConfigurator from './AppConfigurator.vue';
import { useAuth } from '@/composables/useAuth';
import { useBranding } from '@/composables/useBranding';
import { useRouter } from 'vue-router';
import api from '@/service/api';

const router = useRouter();

const { toggleMenu, toggleDarkMode, isDarkTheme } = useLayout();
const { usuario, cargarUsuario } = useAuth();
const { branding, cargarBranding } = useBranding();

const cargar = async () => {
    await cargarUsuario();
    await cargarBranding();

    setTimeout(() => {
        console.log('Usuario actual:', usuario.value);
    }, 1000);
};

cargar();

const logout = async () => {
    try {
        await api.post('/v1/auth/logout');
    } catch (error) {
        console.log(error);
    } finally {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        router.push('/auth/login');
    }
};
</script>

<template>
    <div class="layout-topbar">
        <div class="layout-topbar-logo-container">
            <button class="layout-menu-button layout-topbar-action" @click="toggleMenu">
                <i class="pi pi-bars"></i>
            </button>
            <router-link v-if="branding.logo_url" to="/" class="layout-topbar-logo">
                <img :src="branding.logo_url" :alt="branding.brand_name || 'Logo'" style="height: 2rem; width: auto" />
                <span>{{ branding.brand_name || 'Clinia Doctor' }}</span>
            </router-link>

            <router-link v-else to="/" class="layout-topbar-logo">
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M 77.85 69.5 A 34 34 0 1 1 77.85 30.5" fill="none" stroke="var(--brass)" stroke-width="11" stroke-linecap="round" />
                    <path d="M 81 43 L 88 50 L 81 57 L 74 50 Z" fill="var(--brass)" />
                </svg>

                <span>{{ branding.brand_name || 'Clinia Doctor' }}</span>
            </router-link>
        </div>

        <div class="layout-topbar-actions">
            <div class="layout-config-menu">
                <button type="button" class="layout-topbar-action" @click="toggleDarkMode">
                    <i :class="['pi', { 'pi-moon': isDarkTheme, 'pi-sun': !isDarkTheme }]"></i>
                </button>
                <div class="relative">
                    <button
                        v-styleclass="{ selector: '@next', enterFromClass: 'hidden', enterActiveClass: 'p-anchored-overlay-enter-active', leaveToClass: 'hidden', leaveActiveClass: 'p-anchored-overlay-leave-active', hideOnOutsideClick: true }"
                        type="button"
                        class="layout-topbar-action layout-topbar-action-highlight"
                    >
                        <i class="pi pi-palette"></i>
                    </button>
                    <AppConfigurator />
                </div>
            </div>

            <button
                class="layout-topbar-menu-button layout-topbar-action"
                v-styleclass="{ selector: '@next', enterFromClass: 'hidden', enterActiveClass: 'p-anchored-overlay-enter-active', leaveToClass: 'hidden', leaveActiveClass: 'p-anchored-overlay-leave-active', hideOnOutsideClick: true }"
            >
                <i class="pi pi-ellipsis-v"></i>
            </button>

            <div class="layout-topbar-menu hidden lg:block">
                <div class="layout-topbar-menu-content">
                    <button type="button" class="layout-topbar-action" @click="logout">
                        <i class="pi pi-sign-out"></i>
                        <span>Cerrar sesión</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
