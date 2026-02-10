'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api, { setTokens, clearTokens, getAccessToken } from '@/lib/api';
import { useAppStore } from '@/stores/app-store';
import type { User, LoginCredentials, RegisterData, AuthTokens } from '@/types';

export function useAuth() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { setUser, setIsAuthenticated, setCurrentTenant, reset } = useAppStore();

    // Check if user is authenticated
    const isLoggedIn = useCallback(() => {
        return !!getAccessToken();
    }, []);

    // Get current user
    const {
        data: user,
        isLoading: isLoadingUser,
        refetch: refetchUser,
    } = useQuery({
        queryKey: ['currentUser'],
        queryFn: async () => {
            const response = await api.get<User>('/auth/me/');
            setUser(response);
            setIsAuthenticated(true);
            return response;
        },
        enabled: isLoggedIn(),
        retry: false,
    });

    // Login mutation
    const loginMutation = useMutation({
        mutationFn: async (credentials: LoginCredentials) => {
            const response = await api.post<AuthTokens>('/auth/token/', credentials);
            return response;
        },
        onSuccess: async (data) => {
            setTokens(data.access, data.refresh);
            setIsAuthenticated(true);
            await refetchUser();
            router.push('/');
        },
    });

    // Register mutation
    const registerMutation = useMutation({
        mutationFn: async (data: RegisterData) => {
            const response = await api.post<AuthTokens>('/auth/register/', data);
            return response;
        },
        onSuccess: async (data) => {
            setTokens(data.access, data.refresh);
            setIsAuthenticated(true);
            await refetchUser();
            router.push('/');
        },
    });

    // Logout
    const logout = useCallback(() => {
        clearTokens();
        reset();
        queryClient.clear();
        router.push('/login');
    }, [reset, queryClient, router]);

    return {
        user,
        isLoadingUser,
        isLoggedIn: isLoggedIn(),
        login: loginMutation.mutate,
        loginAsync: loginMutation.mutateAsync,
        isLoggingIn: loginMutation.isPending,
        loginError: loginMutation.error,
        register: registerMutation.mutate,
        registerAsync: registerMutation.mutateAsync,
        isRegistering: registerMutation.isPending,
        registerError: registerMutation.error,
        logout,
        refetchUser,
    };
}
