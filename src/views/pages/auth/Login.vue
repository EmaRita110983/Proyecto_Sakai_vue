<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { palette, updatePrimaryPalette } from '@primeuix/themes';
import { useToast } from 'primevue/usetoast';
import { useLayout } from '@/layout/composables/layout';

import { funLogin, funPerfil } from '@/service/auth.service';

const { toggleDarkMode, isDarkTheme } = useLayout();
const toast = useToast();

const email = ref('');
const password = ref('');
const checked = ref(false);

const router = useRouter();

// Antes de iniciar sesión no hay tenant ni color propio que aplicar (eso lo
// hace useBranding ya autenticado, ver AppTopbar.vue): el login usa el
// bronce fijo de Clinia como color "primario" mientras tanto, con el mismo
// mecanismo (palette + updatePrimaryPalette) que ya usa el resto de la app
// para pintar Button/Checkbox/enlaces con la paleta completa (no solo un
// tono), así se ve bien también en modo oscuro. A propósito no hay selector
// de paleta en esta pantalla (ver template: solo queda el toggle de modo
// oscuro, sin AppConfigurator) para que este color no se pueda cambiar acá.
onMounted(() => {
    updatePrimaryPalette(palette('#B9863B'));
});

const login = async () => {
    try {
        const response = await funLogin(email.value, password.value);

        sessionStorage.setItem('token', response.token);

        const perfil = await funPerfil();

        sessionStorage.setItem('user', JSON.stringify(perfil));

        router.push('/');
    } catch (error) {
        console.error(error);

        toast.add({
            severity: 'error',
            summary: 'No se pudo iniciar sesión',
            detail: error.response?.data?.message || 'Ocurrió un error inesperado',
            life: 8000
        });
    }
};
</script>

<template>
    <Toast />
    <div class="fixed top-8 right-8">
        <Button type="button" @click="toggleDarkMode" rounded :icon="isDarkTheme ? 'pi pi-moon' : 'pi pi-sun'" severity="secondary" />
    </div>
    <div class="bg-surface-50 dark:bg-surface-950 flex items-center justify-center min-h-screen min-w-[100vw] overflow-hidden">
        <div class="flex flex-col items-center justify-center">
            <div style="border-radius: 56px; padding: 0.3rem; background: linear-gradient(180deg, var(--primary-color) 10%, rgba(33, 150, 243, 0) 30%)">
                <div class="w-full bg-surface-0 dark:bg-surface-900 py-20 px-8 sm:px-20" style="border-radius: 53px">
                    <div class="text-center mb-8">
                        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" class="mb-8 w-16 shrink-0 mx-auto">
                            <path d="M 77.85 69.5 A 34 34 0 1 1 77.85 30.5" fill="none" stroke="var(--brass)" stroke-width="11" stroke-linecap="round" />
                            <path d="M 81 43 L 88 50 L 81 57 L 74 50 Z" fill="var(--brass)" />
                        </svg>
                        <div class="text-surface-900 dark:text-surface-0 text-3xl font-medium mb-4 font-display">Bienvenido a Clinia</div>
                        <span class="text-muted-color font-medium">Inicia sesión para continuar</span>
                    </div>

                    <div>
                        <label for="email1" class="block text-surface-900 dark:text-surface-0 text-xl font-medium mb-2">Email</label>
                        <InputText id="email1" type="text" placeholder="Email address" class="w-full md:w-[30rem] mb-8" v-model="email" />

                        <label for="password1" class="block text-surface-900 dark:text-surface-0 font-medium text-xl mb-2">Password</label>
                        <Password id="password1" v-model="password" placeholder="Password" :toggleMask="true" class="mb-4" fluid :feedback="false"></Password>

                        <div class="flex items-center justify-between mt-2 mb-8 gap-8">
                            <div class="flex items-center">
                                <Checkbox v-model="checked" id="rememberme1" binary class="mr-2"></Checkbox>
                                <label for="rememberme1">Remember me</label>
                            </div>
                            <span class="font-medium no-underline ml-2 text-right cursor-pointer text-primary">Forgot password?</span>
                        </div>
                        <Button label="Sign In" class="w-full" @click="login" />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.pi-eye {
    transform: scale(1.6);
    margin-right: 1rem;
}

.pi-eye-slash {
    transform: scale(1.6);
    margin-right: 1rem;
}
</style>
