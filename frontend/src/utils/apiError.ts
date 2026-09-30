import axios from 'axios';

/**
 * Типобезопасный разбор ошибок запросов вместо `catch (err: any)` + `err.response?.data?.detail`.
 * FastAPI возвращает `detail` строкой, а для 422 — массивом объектов { msg }.
 */
export function apiErrorDetail(err: unknown): string | undefined {
    if (!axios.isAxiosError(err)) return undefined;
    const detail = (err.response?.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
        const first = detail[0] as { msg?: unknown } | undefined;
        if (first && typeof first.msg === 'string') return first.msg;
    }
    return undefined;
}

export function apiErrorStatus(err: unknown): number | undefined {
    return axios.isAxiosError(err) ? err.response?.status : undefined;
}

export function errorMessage(err: unknown): string | undefined {
    return err instanceof Error ? err.message : undefined;
}
