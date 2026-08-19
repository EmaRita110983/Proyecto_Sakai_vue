import AppLayout from '@/layout/AppLayout.vue';
import { createRouter, createWebHistory } from 'vue-router';
import { hasRole, getUser, funPerfil } from '@/service/auth.service';

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/',
            component: AppLayout,
            meta: {
                requiresAuth: true
            },
            children: [
                {
                    path: '/usuarios',
                    name: 'usuarios',
                    component: () => import('@/views/usuarios/Usuarios.vue'),
                    meta: {
                        roles: ['superadmin', 'admin']
                    }
                },
                {
                    path: '/pacientes',
                    name: 'pacientes',
                    component: () => import('@/views/pacientes/Pacientes.vue'),
                    meta: {
                        // La secretaria no tiene esta pantalla: solo ve/crea citas
                        // (y, dentro de ese flujo, puede buscar/crear un paciente
                        // desde Dashboard.vue, sin pasar por acá).
                        roles: ['superadmin', 'admin']
                    }
                },
                {
                    path: '/historial',
                    name: 'historial',
                    component: () => import('@/views/historial/HistorialPaciente.vue'),
                    meta: {
                        roles: ['superadmin', 'admin']
                    }
                },
                {
                    path: '/pacientes/:id/historial',
                    name: 'historial-paciente',
                    component: () => import('@/views/historial/HistorialPaciente.vue'),
                    meta: {
                        roles: ['superadmin', 'admin']
                    }
                },
                {
                    path: '/',
                    name: 'dashboard',
                    component: () => import('@/views/Dashboard.vue')
                },
                {
                    path: '/perfil',
                    name: 'perfil',
                    component: () => import('@/views/Profile.vue')
                }
            ]
        },
        {
            path: '/pages/notfound',
            name: 'notfound',
            component: () => import('@/views/pages/NotFound.vue')
        },

        {
            path: '/auth/login',
            name: 'login',
            component: () => import('@/views/pages/auth/Login.vue')
        },
        {
            path: '/auth/cambiar-password',
            name: 'cambiar-password',
            component: () => import('@/views/pages/auth/CambiarPassword.vue'),
            meta: {
                requiresAuth: true
            }
        },
        {
            path: '/auth/access',
            name: 'accessDenied',
            component: () => import('@/views/pages/auth/Access.vue')
        },
        {
            path: '/auth/error',
            name: 'error',
            component: () => import('@/views/pages/auth/Error.vue')
        },
        {
            path: '/:pathMatch(.*)*',
            redirect: '/auth/login'
        }
    ]
});

// Token validado en el backend en esta carga de la app (se resetea solo al
// recargar la página, ya que este módulo se vuelve a inicializar). Evita
// llamar a /v1/auth/profile en cada navegación interna del SPA: solo se
// vuelve a validar si el token cambia (login/logout).
let tokenVerificadoPara = null;

router.beforeEach(async (to, from, next) => {
    const token = sessionStorage.getItem('token');

    if (to.meta.requiresAuth && !token) {
        next('/auth/login');
        return;
    }

    if (to.path === '/auth/login' && token) {
        next('/');
        return;
    }

    // Que exista un token en sessionStorage no garantiza que siga siendo
    // válido (token revocado, etc.). Se valida contra el backend una vez por
    // token antes de dejar pasar a una ruta protegida; si falla, se limpia
    // la sesión local y se manda a login en vez de mostrar la pantalla con
    // datos cacheados del último usuario.
    if (to.meta.requiresAuth && token && tokenVerificadoPara !== token) {
        try {
            const perfil = await funPerfil();

            sessionStorage.setItem('user', JSON.stringify(perfil));
            tokenVerificadoPara = token;
        } catch (error) {
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('user');
            tokenVerificadoPara = null;
            next('/auth/login');
            return;
        }
    }

    // Médico recién creado con la password genérica (ver UserController::store):
    // hasta que no la cambie, el backend rechaza cualquier otra ruta protegida
    // (middleware credentials.changed) — acá se evita ese round-trip
    // redirigiendo directo, salvo que ya esté yendo a cambiar-password o logout.
    if (token && getUser()?.must_change_password && to.name !== 'cambiar-password') {
        next('/auth/cambiar-password');
        return;
    }

    if (to.meta.roles) {
        const permitido = to.meta.roles.some((role) => hasRole(role));

        if (!permitido) {
            next('/auth/access');
            return;
        }
    }

    next();
});

export default router;
