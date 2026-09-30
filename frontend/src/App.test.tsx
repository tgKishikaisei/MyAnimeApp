
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import App from './App';
import type { ReactNode } from 'react';

// Mock child components that use routing/context to avoid setting up complex providers in unit tests
vi.mock('./pages/anime/AnimeClips', () => ({ default: () => <div data-testid="anime-clips-page">AnimeClips Page</div> }));
vi.mock('./context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useAuth: () => ({ login: vi.fn(), logout: vi.fn(), user: null })
}));

describe('App', () => {
  it('renders without crashing and shows default route', async () => {
    // Страница подключена через React.lazy — ждём, пока загрузится чанк.
    const { findByTestId } = render(<App />);
    expect(await findByTestId('anime-clips-page', {}, { timeout: 5000 })).toBeInTheDocument();
  });
});
