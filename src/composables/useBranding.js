import { ref } from 'vue';
import { palette, updatePrimaryPalette } from '@primeuix/themes';
import { funObtenerBranding } from '@/service/tenant.service';

const branding = ref({
    brand_name: null,
    brand_color: null,
    logo_url: null
});

export function useBranding() {
    const aplicarColor = (color) => {
        if (color) {
            updatePrimaryPalette(palette(color));
        }
    };

    // El secundario no tiene un slot propio en el tema de PrimeVue: se expone
    // como variable CSS (--brand-secondary) para detalles puntuales, como el
    // indicador del ítem activo en el menú (ver AppMenuItem.vue).
    const aplicarColorSecundario = (color) => {
        if (color) {
            document.documentElement.style.setProperty('--brand-secondary', color);
        } else {
            document.documentElement.style.removeProperty('--brand-secondary');
        }
    };

    const cargarBranding = async () => {
        try {
            const data = await funObtenerBranding();

            branding.value = data;

            aplicarColor(data.brand_color);
            aplicarColorSecundario(data.brand_color_secondary);
        } catch (error) {
            console.log('No se pudo cargar el branding', error);
        }
    };

    return {
        branding,
        cargarBranding
    };
}
