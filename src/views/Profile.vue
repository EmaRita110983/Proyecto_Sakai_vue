<script setup>
import { ref, onMounted } from 'vue';
import { funPerfil } from '@/service/auth.service';

const usuario = ref(null);

const cargarPerfil = async () => {
    try {
        usuario.value = await funPerfil();
        console.log('PERFIL:', usuario.value);
    } catch (error) {
        console.error('Error cargando perfil:', error);
    }
};

onMounted(() => {
    cargarPerfil();
});
</script>


<template>
    <div>
        <h1>Mi Perfil</h1>

        <div v-if="usuario">
            <p><strong>Nombre:</strong> {{ usuario.name }}</p>
            <p><strong>Email:</strong> {{ usuario.email }}</p>
            <p><strong>Rol:</strong> {{ usuario.role }}</p>
        </div>

        <p v-else>
            Cargando perfil...
        </p>
    </div>
</template>
