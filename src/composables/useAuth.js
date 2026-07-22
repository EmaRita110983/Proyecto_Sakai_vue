import { ref } from 'vue';
import { funPerfil } from '@/service/auth.service';

const usuario = ref(null);

export function useAuth() {

    const cargarUsuario = async () => {
    try {
        const data = await funPerfil();

        console.log('Respuesta perfil:', data);

        usuario.value = data;

    } catch (error) {
        console.log('No se pudo cargar el usuario', error);
        usuario.value = null;
    }
};

    return {
        usuario,
        cargarUsuario
    };
}