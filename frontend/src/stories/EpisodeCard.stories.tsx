import type { Meta, StoryObj } from '@storybook/react-vite';
import EpisodeCard from '../components/EpisodeCard';
import { BrowserRouter } from 'react-router-dom';

const meta = {
    title: 'Components/EpisodeCard',
    component: EpisodeCard,
    parameters: {
        layout: 'centered',
    },
    tags: ['autodocs'],
    decorators: [
        (Story) => (
            <BrowserRouter>
                <div style={{ width: '300px' }}>
                    <Story />
                </div>
            </BrowserRouter>
        ),
    ],
    argTypes: {
        isSelected: { control: 'boolean' },
        isMenuOpen: { control: 'boolean' },
    },
} satisfies Meta<typeof EpisodeCard>;

export default meta;
type Story = StoryObj<typeof meta>;

// Mock data
const mockEpisode = {
    episode_number: 1,
    title: 'Enter the Anime World',
    thumbnail: '',
    url: '',
    clip_count: 5,
    duration: '24:00',
};

export const Default: Story = {
    args: {
        episode: mockEpisode,
        isSelected: false,
        isMenuOpen: false,
        onToggleSelection: (e) => { e.stopPropagation(); console.log('Toggled'); },
        onNavigate: () => console.log('Navigated'),
        onMenuToggle: (e) => { e.stopPropagation(); console.log('Menu Toggled'); },
        onDownload: (e) => { e.stopPropagation(); console.log('Download'); },
    },
};

export const Selected: Story = {
    args: {
        ...Default.args,
        isSelected: true,
    },
};

export const MenuOpen: Story = {
    args: {
        ...Default.args,
        isMenuOpen: true,
    },
};
