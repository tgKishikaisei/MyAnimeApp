import { getImageUrl } from '../../utils/imageUrl';
import { useState, useEffect } from 'react';
import { blogApi } from '../../api/blog';
import { uploadApi } from '../../api/upload';
import type { BlogPost } from '../../api/types';
import { Plus, Trash2, Search, Save, ChevronLeft, Edit2, Upload } from 'lucide-react';
import RichTextEditor from '../../components/RichTextEditor';
import { apiErrorDetail } from '../../utils/apiError';
function migrateContentToHtml(content: string): string {
    if (!content) return '';
    if (content.includes('<p>') || content.includes('<h2>') || content.includes('<h3>')) {
        return content;
    }
    const lines = content.split('\n');
    const html: string[] = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('## ')) {
            html.push(`<h2>${line.slice(3)}</h2>`);
        } else if (line.startsWith('[IMG2:') && line.endsWith(']')) {
            const urls = line.slice(6, -1).split(',').map(u => u.trim());
            urls.forEach(url => html.push(`<img src="${url}" />`));
        } else if (line.startsWith('[IMAGE:') && line.endsWith(']')) {
            const url = line.slice(7, -1).trim();
            html.push(`<img src="${url}" />`);
        } else if (line !== '') {
            html.push(`<p>${line}</p>`);
        }
    }
    return html.join('');
}

const BLOG_DRAFT_KEY = 'blog_manager_draft';

export default function BlogManager() {
    const [posts, setPosts] = useState<BlogPost[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    const [editingPost, setEditingPost] = useState<BlogPost | 'new' | null>(null);
    const [formData, setFormData] = useState({ title: '', image: '', link: '', content: '', color: 'text-white' });
    const [isUploading, setIsUploading] = useState(false);

    const handleImageUpload = async (file: File | null, callback: (url: string) => void) => {
        if (!file) return;
        try {
            setIsUploading(true);
            const data = await uploadApi.image(file);
            const fullUrl = getImageUrl(data.url);
            callback(fullUrl);
        } catch (error) {
            console.error("Upload failed", error);
            alert("Failed to upload image");
        } finally {
            setIsUploading(false);
        }
    };

    // Auto-save draft
    useEffect(() => {
        if (editingPost === 'new') {
            const draft = { formData };
            localStorage.setItem(BLOG_DRAFT_KEY, JSON.stringify(draft));
        }
    }, [formData, editingPost]);

    useEffect(() => { fetchPosts(); }, []);

    const fetchPosts = async () => {
        try {
            setIsLoading(true);
            const data = await blogApi.getAll();
            setPosts(data);
        } catch (error) {
            console.error("Failed to fetch blog posts", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this post?')) return;
        try {
            await blogApi.delete(id);
            setPosts(posts.filter(p => p.id !== id));
            setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
        } catch (error) {
            alert(apiErrorDetail(error) || 'Failed to delete blog post.');
        }
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Delete ${selectedIds.size} selected posts?`)) return;
        setIsBulkDeleting(true);
        let failed = 0;
        for (const id of Array.from(selectedIds)) {
            try { await blogApi.delete(id); } catch { failed++; }
        }
        setSelectedIds(new Set());
        await fetchPosts();
        setIsBulkDeleting(false);
        if (failed > 0) alert(`${failed} items failed to delete.`);
    };

    const toggleSelect = (id: number) => setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    const toggleSelectAll = () => {
        if (allSelected) setSelectedIds(new Set());
        else setSelectedIds(new Set(filtered.map(p => p.id)));
    };

    const filtered = posts.filter(p => p.title.toLowerCase().includes(searchTerm.toLowerCase()));
    const allSelected = filtered.length > 0 && filtered.every(p => selectedIds.has(p.id));
    const someSelected = filtered.some(p => selectedIds.has(p.id));

    // EDITOR ACTIONS
    const openEditor = (post: BlogPost | 'new') => {
        setEditingPost(post);
        if (post === 'new') {
            // Try to load draft
            try {
                const draftStr = localStorage.getItem(BLOG_DRAFT_KEY);
                if (draftStr) {
                    const draft = JSON.parse(draftStr);
                    setFormData(draft.formData || { title: '', image: '', link: '', content: '', color: 'text-white' });
                    window.scrollTo(0, 0);
                    return;
                }
            } catch { /* повреждённый черновик в localStorage игнорируем */ }
            setFormData({ title: '', image: '', link: '', content: '', color: 'text-white' });
        } else {
            setFormData({ 
                title: post.title, 
                image: post.image || '', 
                link: post.link || '', 
                content: migrateContentToHtml(post.content || ''), 
                color: post.color || 'text-white' 
            });
        }
        window.scrollTo(0, 0);
    };

    const closeEditor = () => {
        if (confirm('Discard changes?')) {
            if (editingPost === 'new') localStorage.removeItem(BLOG_DRAFT_KEY);
            setEditingPost(null);
        }
    };

    const handleSave = async () => {
        if (!formData.title) return alert('Title is required');
        const payload = {
            title: formData.title,
            image: formData.image || undefined,
            link: formData.link || undefined,
            content: formData.content,
            color: formData.color
        };

        try {
            if (editingPost === 'new') {
                await blogApi.create(payload);
                localStorage.removeItem(BLOG_DRAFT_KEY);
            } else if (editingPost) {
                await blogApi.update(editingPost.id, payload);
            }
            setEditingPost(null);
            fetchPosts();
        } catch (error) {
            console.error("Failed to save post", error);
            alert("Failed to save post");
        }
    };

    // --- RENDER EDITOR ---
    if (editingPost) {
        return (
            <div className="pb-20 max-w-[1000px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Header Navbar */}
                <div className="sticky top-0 z-40 bg-[#0f0f0f]/95 backdrop-blur-xl border-b border-white/10 pb-4 mb-8 pt-4 flex justify-between items-center">
                    <button onClick={closeEditor} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                        <ChevronLeft className="w-5 h-5" /> Back to Posts
                    </button>
                    <div className="font-bold text-white tracking-widest uppercase">
                        {editingPost === 'new' ? 'New Article' : 'Edit Article'}
                    </div>
                    <button onClick={handleSave} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-md font-bold transition-colors">
                        <Save className="w-4 h-4" /> Save Post
                    </button>
                </div>

                {/* Main Settings */}
                <div className="bg-[#111] border border-white/10 p-6 rounded-xl mb-8 space-y-6 shadow-2xl">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">Main Title *</label>
                        <input
                            type="text"
                            className="w-full bg-black border border-white/10 text-white text-xl md:text-3xl font-black uppercase rounded-lg p-4 focus:border-red-600 outline-none"
                            placeholder="ARTICLE TITLE..."
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">Hero Image URL</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    className="flex-1 bg-black border border-white/10 text-white rounded p-3 focus:border-red-600 outline-none text-sm placeholder-gray-700"
                                    placeholder="https://example.com/cover.jpg"
                                    value={formData.image}
                                    onChange={e => setFormData({ ...formData, image: e.target.value })}
                                />
                                <label className="flex items-center justify-center bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded px-4 cursor-pointer transition-colors" title="Upload Image">
                                    <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e.target.files?.[0] || null, url => setFormData({ ...formData, image: url }))} />
                                    {isUploading ? <span className="animate-spin">⌛</span> : <Upload className="w-5 h-5 text-gray-400" />}
                                </label>
                            </div>
                            {formData.image && <img src={formData.image} alt="preview" className="mt-4 rounded border border-white/10 w-full h-32 object-cover opacity-80" />}
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">External Link (Optional)</label>
                            <input
                                type="text"
                                className="w-full bg-black border border-white/10 text-white rounded p-3 focus:border-red-600 outline-none text-sm placeholder-gray-700"
                                placeholder="https://external.link/..."
                                value={formData.link}
                                onChange={e => setFormData({ ...formData, link: e.target.value })}
                            />
                        </div>
                    </div>
                </div>

                {/* Blocks Builder */}
                <div className="mb-4 flex items-center gap-4">
                    <h2 className="text-xl font-black text-white uppercase tracking-tighter">Content Editor</h2>
                    <div className="h-[1px] bg-white/10 flex-1"></div>
                </div>

                <div className="mb-8">
                    <RichTextEditor 
                        content={formData.content} 
                        onChange={(html) => setFormData({ ...formData, content: html })} 
                        onImageUpload={handleImageUpload}
                    />
                </div>
            </div>
        );
    }

    // --- RENDER LIST ---
    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-black text-white tracking-tighter uppercase">Blog Manager</h1>
                <button
                    onClick={() => openEditor('new')}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-bold transition-colors"
                >
                    <Plus className="w-5 h-5" /> Add Post
                </button>
            </div>

            <div className="bg-[#111] border border-white/10 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                        <span className="text-white font-bold text-base">Blog Posts</span>
                        {someSelected && (
                            <>
                                <span className="text-gray-600">›</span>
                                <span className="text-white font-medium">({selectedIds.size}) selected</span>
                                <button onClick={() => setSelectedIds(new Set())} className="text-gray-500 hover:text-white text-xs ml-1">✕ clear</button>
                            </>
                        )}
                    </div>
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

                <div className="px-6 py-3 border-b border-white/10">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search posts..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 text-white rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-white/30 placeholder-gray-500"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-gray-400">
                        <thead className="bg-black/30 text-xs uppercase font-bold text-gray-600 border-b border-white/5">
                            <tr>
                                <th className="px-4 py-3 w-10">
                                    <div
                                        onClick={toggleSelectAll}
                                        className="w-5 h-5 rounded-full border-2 cursor-pointer transition-all flex items-center justify-center border-white/40 hover:border-white"
                                        style={allSelected ? { borderColor: 'white', background: 'white' } : someSelected ? { borderColor: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.15)' } : {}}
                                    >
                                        {allSelected && <div className="w-2.5 h-2.5 rounded-full bg-black" />}
                                        {someSelected && !allSelected && <div className="w-1.5 h-1.5 rounded-full bg-white/70" />}
                                    </div>
                                </th>
                                <th className="px-4 py-3">Image</th>
                                <th className="px-4 py-3">Title</th>
                                <th className="px-4 py-3" colSpan={2}>Content Preview</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {isLoading ? (
                                <tr><td colSpan={6} className="text-center py-10 text-gray-500">Loading...</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-10 text-gray-500">No posts found</td></tr>
                            ) : filtered.map((post) => {
                                const isSelected = selectedIds.has(post.id);
                                return (
                                    <tr key={post.id} className={`transition-colors group ${isSelected ? 'bg-white/5' : 'hover:bg-white/[0.03]'}`}>
                                        <td className="px-4 py-3">
                                            <div
                                                onClick={() => toggleSelect(post.id)}
                                                className={`w-5 h-5 rounded-full border-2 cursor-pointer transition-all flex items-center justify-center ${isSelected ? 'border-white bg-white' : 'border-white/30 bg-transparent group-hover:border-white/60'}`}
                                            >
                                                {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-black" />}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {post.image
                                                ? <img src={post.image} alt={post.title} className="w-16 h-10 object-cover rounded" />
                                                : <span className="text-gray-600 text-xs italic">no image</span>
                                            }
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-white truncate max-w-[200px]">{post.title}</div>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-500" colSpan={2}>
                                            <div className="truncate max-w-[300px]">
                                                {post.content ? post.content.replace(/\[IMAGE:.*?\]|\[IMG2:.*?\]|##/g, '').trim() : 'No text content'}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right flex items-center justify-end gap-3">
                                            <button onClick={() => openEditor(post)} className="text-gray-500 hover:text-white transition-colors" title="Edit Post">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(post.id)} className="text-gray-500 hover:text-red-400 transition-colors" title="Delete Post">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
