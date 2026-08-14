import { ref } from 'vue';

// Señal compartida: se incrementa cada vez que se hace clic en "Usuarios"/
// "Secretaria" del sidebar (ver AppMenu.vue), incluso si ya se estaba en esa
// pantalla. En ese caso Vue Router no navega ni dispara nada (misma ruta,
// sin cambios), así que Usuarios.vue no tiene otra forma de enterarse de
// que debe limpiar el filtro de búsqueda y volver a mostrar todos los
// usuarios.
export const usuariosFilterResetSignal = ref(0);

export function solicitarLimpiarFiltroUsuarios() {
    usuariosFilterResetSignal.value++;
}
