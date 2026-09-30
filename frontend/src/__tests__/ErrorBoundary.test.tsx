import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from '../components/ErrorBoundary';

// Бутафорский компонент, который специально падает, чтобы проверить ErrorBoundary
const ProblemChild = () => {
    throw new Error('Test crash!');
    return <div>Won't render</div>;
};

describe('ErrorBoundary', () => {
    it('renders children when there is no error', () => {
        render(
            <ErrorBoundary>
                <div>Everything is fine</div>
            </ErrorBoundary>
        );
        expect(screen.getByText('Everything is fine')).toBeInTheDocument();
    });

    it('catches error and displays fallback UI', () => {
        // Подавляем console.error для чистого вывода тестов, так как React будет ругаться на throw
        const spyError = vi.spyOn(console, 'error').mockImplementation(() => {});

        render(
            <ErrorBoundary>
                <ProblemChild />
            </ErrorBoundary>
        );

        // Проверяем, что fallback UI отрендерился
        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
        expect(screen.getByText(/The app encountered an unexpected error/i)).toBeInTheDocument();
        expect(screen.getByText('🔄 Reload page')).toBeInTheDocument();

        spyError.mockRestore();
    });
});
