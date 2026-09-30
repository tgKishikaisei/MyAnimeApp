import { useState, useEffect, useRef, useCallback } from 'react';
import { animeApi } from '../../api/anime';
import type { Anime } from '../../api/types';
import { Plus, Edit, Trash2, Search, X, Upload, DownloadCloud, GripVertical } from 'lucide-react';
import JikanImportModal from './JikanImportModal';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

import { apiErrorDetail } from '../../utils/apiError';
// --- Sortable Table Row Component ---
function SortableAnimeRow({
    anime,
    isSelected,
    onToggleSelect,
    onEdit,
    onDelete,
}: {
    anime: Anime;
    isSelected: boolean;
    onToggleSelect: (id: number) => void;
    onEdit: (anime: Anime) => void;
    onDelete: (id: number) => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: anime.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 50 : undefined,
    };

    return (
        <tr
            ref={setNodeRef}
            style={style}
            className={`transition-colors group ${isSelected ? 'bg-white/5' : 'hover:bg-white/[0.03]'}`}
        >
            {/* Drag Handle */}
            <td className="px-2 py-3 w-8">
                <button
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing text-gray-600 hover:text-white transition-colors p-1 rounded hover:bg-white/10"
                    title="Drag to reorder"
                >
                    <GripVertical className="w-4 h-4" />
                </button>
            </td>
            {/* Checkbox */}
            <td className="px-4 py-3">
                <div
                    onClick={() => onToggleSelect(anime.id)}
                    className={`w-5 h-5 rounded-full border-2 cursor-pointer transition-all flex items-center justify-center ${isSelected
                        ? 'border-white bg-white'
                        : 'border-white/30 bg-transparent group-hover:border-white/60'
                    }`}
                >
                    {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-black" />}
                </div>
            </td>
            <td className="px-4 py-3">
                <img src={anime.image} alt={anime.title} className="w-12 h-16 object-cover rounded" />
            </td>
            <td className="px-4 py-3 font-medium text-white">{anime.title}</td>
            <td className="px-4 py-3">
                <span className="px-2 py-0.5 rounded bg-white/5 text-xs text-gray-400 uppercase tracking-wider">{anime.section}</span>
            </td>
            <td className="px-4 py-3 text-gray-500 text-sm">{anime.year || '—'}</td>
            <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-3">
                    <button
                        onClick={() => onEdit(anime)}
                        className="text-gray-500 hover:text-blue-400 transition-colors"
                    >
                        <Edit className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onDelete(anime.id)}
                        className="text-gray-500 hover:text-red-400 transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </td>
        </tr>
    );
}

const DRAFT_KEY = 'anime_manager_draft';

export default function AnimeManager() {
    const [animes, setAnimes] = useState<Anime[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isJikanModalOpen, setIsJikanModalOpen] = useState(false);
    const [isMalModalOpen, setIsMalModalOpen] = useState(false);
    const [malId, setMalId] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [editingAnime, setEditingAnime] = useState<Anime | null>(null);

    // Initialize form state (try to load draft for 'new' anime)
    const loadDraft = () => {
        try {
            const draft = localStorage.getItem(DRAFT_KEY);
            if (draft) return JSON.parse(draft);
        } catch { /* повреждённый черновик в localStorage игнорируем */ }
        return null;
    };
    const initialDraft = loadDraft();

    // Form state
    const [title, setTitle] = useState(initialDraft?.title || '');
    const [description, setDescription] = useState(initialDraft?.description || '');
    const [imageFile, setImageFile] = useState<File | null>(null); // Files can't be localStorage saved
    const [section, setSection] = useState(initialDraft?.section || 'popular');
    const [year, setYear] = useState<string>(initialDraft?.year || '');
    const [imageUrl, setImageUrl] = useState<string>(initialDraft?.imageUrl || ''); // URL from Jikan
    const [isSaving, setIsSaving] = useState(false);

    // Bulk select state
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [sectionFilter, setSectionFilter] = useState<string>('all');
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchAnimes();
    }, []);

    useEffect(() => {
        if (editingAnime) {
            setTitle(editingAnime.title);
            setDescription(editingAnime.description || '');
            setSection(editingAnime.section || 'popular');
        }
    }, [editingAnime]);

    // Auto-save draft for NEW anime when modal is open
    useEffect(() => {
        if (isModalOpen && !editingAnime) {
            const draft = { title, description, section, year, imageUrl };
            localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        }
    }, [title, description, section, year, imageUrl, isModalOpen, editingAnime]);

    const fetchAnimes = async () => {
        try {
            setIsLoading(true);
            const data = await animeApi.getAll(undefined, true);
            setAnimes(data);
        } catch (error) {
            console.error("Failed to fetch anime", error);
        } finally {
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setImageFile(null);
        setImageUrl('');
        setYear('');
        setSection('popular');
        localStorage.removeItem(DRAFT_KEY);
    };

    const handleSave = async () => {
        if (!title.trim()) {
            alert('Please enter a title');
            return;
        }

        if (!editingAnime && !imageFile && !imageUrl) {
            alert('Please select an image file or import from MAL');
            return;
        }

        try {
            setIsSaving(true);

            if (editingAnime) {
                await animeApi.update(editingAnime.id, { title, description, section, year: year ? Number(year) : undefined });
            } else {
                if (imageFile) {
                    // Upload with local file
                    await animeApi.uploadAnime(imageFile, { title, description, section, year: year ? Number(year) : undefined });
                } else if (imageUrl) {
                    // Save with URL from Jikan (no file upload needed)
                    await animeApi.create({ title, description, section, image: imageUrl, year: year ? Number(year) : undefined });
                } else {
                    alert('Please select an image for new Anime');
                    setIsSaving(false);
                    return;
                }
            }
            await fetchAnimes();
            localStorage.removeItem(DRAFT_KEY);
            setIsModalOpen(false);
            setEditingAnime(null);
            resetForm();
        } catch (error) {
            console.error('Failed to save anime', error);
            alert('Error saving anime');
        } finally {
            setIsSaving(false);
        }
    };

    const handleMalImport = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!malId) return;
        setIsImporting(true);
        try {
            const data = await animeApi.importFromMal(parseInt(malId));
            // Pre-fill ALL form fields from Jikan
            setTitle(data.title || '');
            setDescription(data.description || '');
            setSection(data.section || 'popular');
            setYear(data.year ? String(data.year) : '');
            if (data.image && data.image !== '/placeholder.png') {
                setImageUrl(data.image);
                setImageFile(null); // clear any previously selected file
            }
            setIsMalModalOpen(false);
            setMalId('');
            setEditingAnime(null);
            setIsModalOpen(true);
        } catch (error) {
            console.error('MAL Import Failed', error);
            alert(apiErrorDetail(error) || 'Failed to import from MyAnimeList');
        } finally {
            setIsImporting(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this anime?')) return;
        try {
            await animeApi.delete(id);
            setAnimes(animes.filter(a => a.id !== id));
        } catch (error) {
            console.error("Failed to delete", error);
            alert(apiErrorDetail(error) || 'Failed to delete anime. Please check the server logs.');
        }
    };

    const filteredAnimes = animes.filter(anime => {
        const matchSearch = anime.title.toLowerCase().includes(searchTerm.toLowerCase());
        const matchSection = sectionFilter === 'all' || anime.section === sectionFilter;
        return matchSearch && matchSection;
    });

    // --- Bulk select helpers ---
    const allSelected = filteredAnimes.length > 0 && filteredAnimes.every(a => selectedIds.has(a.id));
    const someSelected = filteredAnimes.some(a => selectedIds.has(a.id));

    const toggleSelectAll = () => {
        if (allSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredAnimes.map(a => a.id)));
        }
    };

    const toggleSelect = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Are you sure you want to delete ${selectedIds.size} selected anime?`)) return;
        setIsBulkDeleting(true);
        const ids = Array.from(selectedIds);
        let failed = 0;
        for (const id of ids) {
            try {
                await animeApi.delete(id);
            } catch {
                failed++;
            }
        }
        setSelectedIds(new Set());
        await fetchAnimes();
        setIsBulkDeleting(false);
        if (failed > 0) alert(`${failed} items failed to delete.`);
    };

    // --- DnD Kit ---
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 },
        }),
        useSensor(KeyboardSensor)
    );

    const handleDragEnd = useCallback(async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = animes.findIndex(a => a.id === active.id);
        const newIndex = animes.findIndex(a => a.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;

        // Optimistic reorder in state
        const reordered = arrayMove([...animes], oldIndex, newIndex);
        setAnimes(reordered);

        // Persist to backend
        try {
            await animeApi.reorder(reordered.map(a => a.id));
        } catch (error) {
            console.error('Failed to save order', error);
            // Revert on failure
            await fetchAnimes();
        }
    }, [animes]);

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-black text-white tracking-tighter uppercase">Anime Manager</h1>
                <div className="flex gap-4">
                    <button
                        onClick={() => setIsJikanModalOpen(true)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md font-bold transition-colors shadow-lg shadow-blue-500/20"
                    >
                        <DownloadCloud className="w-5 h-5" /> Auto-Import (MAL)
                    </button>
                    <button
                        onClick={() => setIsMalModalOpen(true)}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-bold transition-colors"
                    >
                        <DownloadCloud className="w-5 h-5" /> MAL by ID
                    </button>
                    <button
                        onClick={() => { setEditingAnime(null); setIsModalOpen(true); }}
                        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-bold transition-colors"
                    >
                        <Plus className="w-5 h-5" /> Add Anime
                    </button>
                </div>
            </div>

            <div className="bg-[#111] border border-white/10 rounded-xl overflow-hidden">

                {/* Header: title + selected count + action buttons */}
                <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                        <span className="text-white font-bold text-base">Anime List</span>
                        {someSelected && (
                            <>
                                <span className="text-gray-600">›</span>
                                <span className="text-white font-medium">({selectedIds.size}) selected</span>
                                <button
                                    onClick={() => setSelectedIds(new Set())}
                                    className="text-gray-500 hover:text-white transition-colors text-xs ml-1"
                                >
                                    ✕ clear
                                </button>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {someSelected && (
                            <button
                                onClick={handleBulkDelete}
                                disabled={isBulkDeleting}
                                className="flex items-center gap-2 bg-red-700/80 hover:bg-red-600 disabled:opacity-50 text-white px-3 py-1.5 rounded text-sm font-bold transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                                {isBulkDeleting ? 'Deleting...' : `Delete (${selectedIds.size})`}
                            </button>
                        )}
                    </div>
                </div>

                {/* Section filter pills */}
                <div className="px-6 py-3 border-b border-white/10 flex gap-1 flex-wrap">
                    {['all', 'popular', 'recent', 'series', 'movies', 'ongoing', 'early_access', 'coming_soon'].map(s => (
                        <button
                            key={s}
                            onClick={() => setSectionFilter(s)}
                            className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${sectionFilter === s
                                ? 'bg-white text-black'
                                : 'text-gray-400 hover:text-white hover:bg-white/10'
                                }`}
                        >
                            {s === 'all' ? 'All' : s.replace('_', ' ')}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="px-6 py-3 border-b border-white/10">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search anime..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 text-white rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-white/30 placeholder-gray-500"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                        modifiers={[restrictToVerticalAxis]}
                    >
                        <table className="w-full text-left text-gray-400">
                            <thead className="bg-black/30 text-xs uppercase font-bold text-gray-600 border-b border-white/5">
                                <tr>
                                    <th className="px-2 py-3 w-8"></th>
                                    <th className="px-4 py-3 w-10">
                                        {/* Select-all circle */}
                                        <div
                                            onClick={toggleSelectAll}
                                            className="w-5 h-5 rounded-full border-2 cursor-pointer transition-all flex items-center justify-center
                                                border-white/40 hover:border-white
                                                bg-transparent"
                                            style={allSelected ? { borderColor: 'white', background: 'white' } : someSelected ? { borderColor: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.15)' } : {}}
                                        >
                                            {allSelected && <div className="w-2.5 h-2.5 rounded-full bg-black" />}
                                            {someSelected && !allSelected && <div className="w-1.5 h-1.5 rounded-full bg-white/70" />}
                                        </div>
                                    </th>
                                    <th className="px-4 py-3">Image</th>
                                    <th className="px-4 py-3">Title</th>
                                    <th className="px-4 py-3">Section</th>
                                    <th className="px-4 py-3">Year</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <SortableContext
                                items={filteredAnimes.map(a => a.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                <tbody className="divide-y divide-white/5">
                                    {isLoading ? (
                                        <tr><td colSpan={7} className="text-center py-10 text-gray-500">Loading...</td></tr>
                                    ) : filteredAnimes.length === 0 ? (
                                        <tr><td colSpan={7} className="text-center py-10 text-gray-500">No anime found</td></tr>
                                    ) : filteredAnimes.map((anime) => (
                                        <SortableAnimeRow
                                            key={anime.id}
                                            anime={anime}
                                            isSelected={selectedIds.has(anime.id)}
                                            onToggleSelect={toggleSelect}
                                            onEdit={(a) => { setEditingAnime(a); setIsModalOpen(true); }}
                                            onDelete={handleDelete}
                                        />
                                    ))}
                                </tbody>
                            </SortableContext>
                        </table>
                    </DndContext>
                </div>
            </div>

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-[#111] border border-white/10 p-8 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-white">
                                {editingAnime ? 'Edit Anime' : 'Add New Anime'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Title */}
                            <div>
                                <label className="block text-sm font-bold text-gray-400 mb-2">Title *</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full bg-black border border-white/10 text-white rounded-md px-4 py-2 focus:outline-none focus:border-red-600"
                                    placeholder="Enter anime title"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-bold text-gray-400 mb-2">Description</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={4}
                                    className="w-full bg-black border border-white/10 text-white rounded-md px-4 py-2 focus:outline-none focus:border-red-600"
                                    placeholder="Enter description"
                                />
                            </div>

                            {/* Section */}
                            <div>
                                <label className="block text-sm font-bold text-gray-400 mb-2">Section *</label>
                                <select
                                    value={section}
                                    onChange={(e) => setSection(e.target.value)}
                                    className="w-full bg-black border border-white/10 text-white rounded-md px-4 py-2 focus:outline-none focus:border-red-600"
                                >
                                    <option value="popular">Popular</option>
                                    <option value="recent">Recent</option>
                                    <option value="series">Series</option>
                                    <option value="movies">Movies</option>
                                    <option value="early_access">Early Access</option>
                                    <option value="coming_soon">Coming Soon</option>
                                    <option value="active_packs">Active Packs</option>
                                </select>
                            </div>

                            {/* Image + Year input */}
                            {!editingAnime && (
                                <div className="space-y-4">
                                    {/* Image from Jikan preview */}
                                    {imageUrl && (
                                        <div className="flex flex-col gap-2">
                                            <label className="block text-sm font-bold text-gray-400">Image from MAL <span className="text-green-400 text-xs">(auto-imported)</span></label>
                                            <div className="flex items-center gap-4">
                                                <img
                                                    src={imageUrl}
                                                    alt="MAL Cover"
                                                    className="w-20 h-28 object-cover rounded border border-white/20"
                                                />
                                                <div className="text-xs text-gray-400">
                                                    <p>Cover imported from MyAnimeList.</p>
                                                    <button
                                                        type="button"
                                                        onClick={() => setImageUrl('')}
                                                        className="mt-2 text-red-400 hover:text-red-300 underline"
                                                    >
                                                        Remove and upload manually
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Manual file upload (only if no Jikan image) */}
                                    {!imageUrl && (
                                        <div>
                                            <label className="block text-sm font-bold text-gray-400 mb-2">Image File *</label>
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                                                className="hidden"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                className="w-full bg-black border-2 border-dashed border-white/20 hover:border-red-600 text-white rounded-md px-4 py-8 transition-colors flex flex-col items-center gap-2"
                                            >
                                                <Upload className="w-8 h-8" />
                                                {imageFile ? (
                                                    <span className="text-sm">{imageFile.name}</span>
                                                ) : (
                                                    <span className="text-sm">Click to select image file</span>
                                                )}
                                            </button>
                                            {imageFile && (
                                                <div className="mt-4">
                                                    <img
                                                        src={URL.createObjectURL(imageFile)}
                                                        alt="Preview"
                                                        className="w-32 h-32 object-cover rounded border border-white/10"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Year */}
                            <div>
                                <label className="block text-sm font-bold text-gray-400 mb-2">Year</label>
                                <input
                                    type="number"
                                    value={year}
                                    onChange={(e) => setYear(e.target.value)}
                                    className="w-full bg-black border border-white/10 text-white rounded-md px-4 py-2 focus:outline-none focus:border-red-600"
                                    placeholder="e.g. 2003"
                                    min="1900"
                                    max="2100"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                disabled={isSaving}
                                className="px-4 py-2 text-gray-400 hover:text-white disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving || !title.trim() || (!editingAnime && !imageFile && !imageUrl)}
                                className="px-6 py-2 bg-red-600 text-white rounded font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSaving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MAL Import Modal (Manual by ID) */}
            {isMalModalOpen && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
                    <div className="bg-[#111] border border-white/10 rounded-xl w-full max-w-md overflow-hidden">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-indigo-900/20">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <DownloadCloud className="w-5 h-5 text-indigo-400" />
                                Import by MAL ID
                            </h2>
                            <button onClick={() => setIsMalModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleMalImport} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">MyAnimeList ID</label>
                                <input
                                    type="number"
                                    value={malId}
                                    onChange={e => setMalId(e.target.value)}
                                    className="w-full bg-black border border-white/10 text-white rounded-md px-4 py-2 focus:outline-none focus:border-indigo-600"
                                    placeholder="e.g. 52991 (Frieren)"
                                    required
                                    min="1"
                                />
                                <p className="text-xs text-gray-500 mt-2">
                                    This will fetch the title and synopsis from Jikan API and pre-fill the creation form. You will still need to manually apply a cover image.
                                </p>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                                <button
                                    type="button"
                                    onClick={() => setIsMalModalOpen(false)}
                                    className="px-4 py-2 rounded-md text-gray-300 hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isImporting || !malId}
                                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-md font-bold transition-colors flex items-center gap-2"
                                >
                                    {isImporting ? 'Importing...' : 'Fetch Data'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Jikan Auto-Parser Modal (Search) */}
            <JikanImportModal
                isOpen={isJikanModalOpen}
                onClose={() => setIsJikanModalOpen(false)}
                onSuccess={fetchAnimes}
            />

        </div>
    );
}
