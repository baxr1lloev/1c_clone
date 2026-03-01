import axios, { AxiosError, InternalAxiosRequestConfig, AxiosInstance, AxiosRequestConfig } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

// Create axios instance
const axiosInstance = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Token storage keys
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// Token management functions
export const getAccessToken = (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ACCESS_TOKEN_KEY);
};

export const getRefreshToken = (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
};

export const setTokens = (access: string, refresh: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(ACCESS_TOKEN_KEY, access);
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
};

export const clearTokens = (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
};

const redirectToLogin = (): void => {
    if (typeof window === 'undefined') return;
    if (window.location.pathname !== '/login') {
        window.location.href = '/login';
    }
};

const isAuthRequest = (url?: string): boolean => {
    if (!url) return false;

    return (
        url.includes('/auth/token/') ||
        url.includes('/auth/token/refresh/') ||
        url.includes('/auth/register/')
    );
};

// Request interceptor - add auth header
axiosInstance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const token = getAccessToken();
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
let isRefreshing = false;
let failedQueue: Array<{
    resolve: (token: string) => void;
    reject: (error: AxiosError) => void;
}> = [];

const processQueue = (error: AxiosError | null, token: string | null = null) => {
    failedQueue.forEach((promise) => {
        if (error) {
            promise.reject(error);
        } else if (token) {
            promise.resolve(token);
        }
    });
    failedQueue = [];
};

axiosInstance.interceptors.response.use(
    (response) => response.data,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        if (error.response?.status !== 401 || !originalRequest) {
            return Promise.reject(error);
        }

        // Do not try to refresh on explicit auth endpoints such as login/register.
        if (isAuthRequest(originalRequest.url)) {
            return Promise.reject(error);
        }

        // A second 401 after refresh means the current session is no longer valid.
        if (originalRequest._retry) {
            clearTokens();
            redirectToLogin();
            return Promise.reject(error);
        }

        // If 401 and not already retrying
        if (error.response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                // Queue this request while token is being refreshed
                return new Promise((resolve, reject) => {
                    failedQueue.push({
                        resolve: (token: string) => {
                            if (originalRequest.headers) {
                                originalRequest.headers.Authorization = `Bearer ${token}`;
                            }
                            resolve(axiosInstance(originalRequest));
                        },
                        reject: (err: AxiosError) => {
                            reject(err);
                        },
                    });
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            const refreshToken = getRefreshToken();
            if (!refreshToken) {
                clearTokens();
                redirectToLogin();
                return Promise.reject(error);
            }

            try {
                const response = await axios.post<{ access: string; refresh?: string }>(`${API_BASE_URL}/auth/token/refresh/`, {
                    refresh: refreshToken,
                });

                const { access, refresh: nextRefreshToken } = response.data;
                setTokens(access, nextRefreshToken || refreshToken);
                processQueue(null, access);

                if (originalRequest.headers) {
                    originalRequest.headers.Authorization = `Bearer ${access}`;
                }
                return axiosInstance(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError as AxiosError, null);
                clearTokens();
                redirectToLogin();
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

/* eslint-disable @typescript-eslint/no-explicit-any */
// Define strict type for API that returns data directly
interface ApiClient extends Omit<AxiosInstance, 'get' | 'post' | 'put' | 'delete' | 'patch'> {
    get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T>;
    post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>;
    put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>;
    delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T>;
    patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const api = axiosInstance as ApiClient;
export default api;
