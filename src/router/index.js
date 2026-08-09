import AppLayout from '@/layout/AppLayout.vue';
import { createRouter, createWebHistory } from 'vue-router';
import { hasRole } from '@/service/auth.service';

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
                        roles: ['superadmin', 'admin', 'secretaria']
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

router.beforeEach((to, from, next) => {
    const token = localStorage.getItem('token');

    if (to.meta.requiresAuth && !token) {
        next('/auth/login');
        return;
    }

    if (to.path === '/auth/login' && token) {
        next('/');
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
