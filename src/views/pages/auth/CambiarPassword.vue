<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { palette, updatePrimaryPalette } from '@primeuix/themes';
import { useToast } from 'primevue/usetoast';

import { funCambiarPassword, funLogout } from '@/service/auth.service';

const toast = useToast();
const router = useRouter();

const password = ref('');
const passwordConfirmation = ref('');
const guardando = ref(false);

// Mismo bronce fijo que usa Login.vue: esta pantalla se pisa antes de que el
// médico tenga acceso al resto de la app, así que tampoco hay tenant/color
// propio que aplicar todavía.
onMounted(() => {
    updatePrimaryPalette(palette('#B9863B'));
});

const guardar = async () => {
    // Mismo mínimo que el backend (ver AuthController::funCambiarPassword) —
    // si se desincroniza, el usuario ve "guardado" acá y recién se entera
    // del rechazo real en el toast de error genérico del catch.
    if (password.value.length < 12) {
        toast.add({
            severity: 'warn',
            summary: 'Contraseña muy corta',
            detail: 'Debe tener al menos 12 caracteres',
            life: 3000
        });
        return;
    }

    if (password.value !== passwordConfirmation.value) {
        toast.add({
            severity: 'warn',
            summary: 'Las contraseñas no coinciden',
            detail: 'Verifica que ambos campos sean iguales',
            life: 3000
        });
        return;
    }

    guardando.value = true;

    try {
        await funCambiarPassword(password.value, passwordConfirmation.value);

        const user = JSON.parse(sessionStorage.getItem('user'));
        user.must_change_password = false;
        sessionStorage.setItem('user', JSON.stringify(user));

        toast.add({
            severity: 'success',
            summary: 'Contraseña actualizada',
            detail: 'Ya puedes usar el sistema con normalidad',
            life: 3000
        });

        router.push('/');
    } catch (error) {
        console.error(error);

        toast.add({
            severity: 'error',
            summary: 'No se pudo actualizar la contraseña',
            detail: error.response?.data?.message || 'Ocurrió un error inesperado',
            life: 4000
        });
    } finally {
        guardando.value = false;
    }
};

const cerrarSesion = async () => {
    try {
        await funLogout();
    } catch (error) {
        console.error(error);
    } finally {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        router.push('/auth/login');
    }
};
</script>

<template>
    <Toast />
    <div class="bg-surface-50 dark:bg-surface-950 flex items-center justify-center min-h-screen min-w-[100vw] overflow-hidden">
        <div class="flex flex-col items-center justify-center">
            <div style="border-radius: 56px; padding: 0.3rem; background: linear-gradient(180deg, var(--primary-color) 10%, rgba(33, 150, 243, 0) 30%)">
                <div class="w-full bg-surface-0 dark:bg-surface-900 py-20 px-8 sm:px-20" style="border-radius: 53px">
                    <div class="text-center mb-8">
                        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" class="mb-8 w-16 shrink-0 mx-auto">
                            <path d="M 77.85 69.5 A 34 34 0 1 1 77.85 30.5" fill="none" stroke="var(--brass)" stroke-width="11" stroke-linecap="round" />
                            <path d="M 81 43 L 88 50 L 81 57 L 74 50 Z" fill="var(--brass)" />
                        </svg>
                        <div class="text-surface-900 dark:text-surface-0 text-3xl font-medium mb-4 font-display">Cambio de contraseña obligatorio</div>
                        <span class="text-muted-color font-medium">Es tu primer inicio de sesión: define una nueva contraseña para continuar</span>
                    </div>

                    <div>
                        <label for="password1" class="block text-surface-900 dark:text-surface-0 font-medium text-xl mb-2">Nueva contraseña</label>
                        <Password id="password1" v-model="password" placeholder="Mínimo 12 caracteres" :toggleMask="true" class="mb-4" fluid :feedback="false"></Password>

                        <label for="password2" class="block text-surface-900 dark:text-surface-0 font-medium text-xl mb-2">Confirmar contraseña</label>
                        <Password id="password2" v-model="passwordConfirmation" placeholder="Repite la contraseña" :toggleMask="true" class="mb-8" fluid :feedback="false"></Password>

                        <Button label="Guardar y continuar" class="w-full mb-3" :loading="guardando" @click="guardar" />
                        <Button label="Cerrar sesión" severity="secondary" text class="w-full" @click="cerrarSesion" />
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
