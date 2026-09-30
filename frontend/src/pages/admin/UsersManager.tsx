import { useState, useEffect } from 'react';
import { adminApi } from '../../api/admin';
import type { User } from '../../api/types';
import { Users, ShieldAlert, CheckCircle2, Shield, Download, Gavel, Unlock, Search } from 'lucide-react';

export default function UsersManager() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [updatingParams, setUpdatingParams] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'creator' | 'viewer'>('all');

    const [banModalUser, setBanModalUser] = useState<User | null>(null);
    const [banReason, setBanReason] = useState('');
    const [banDays, setBanDays] = useState('7');
    const [isSubmittingBan, setIsSubmittingBan] = useState(false);

    // Permissions modal state
    const [permissionsModalUser, setPermissionsModalUser] = useState<User | null>(null);
    const [currentPermissions, setCurrentPermissions] = useState<Record<string, boolean>>({});
    const [isSubmittingPermissions, setIsSubmittingPermissions] = useState(false);

    const PERMISSION_KEYS = [
        { key: 'can_edit_anime', label: 'Edit Anime' },
        { key: 'can_delete_comments', label: 'Delete Comments' },
        { key: 'can_manage_settings', label: 'Manage Settings' },
        { key: 'can_ban_users', label: 'Ban Users' }
    ];

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const data = await adminApi.getUsers(0, 500); // fetch up to 500 users
            setUsers(data);
        } catch (error) {
            console.error('Failed to fetch users', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (userId: number, newRole: string) => {
        try {
            setUpdatingParams(userId);
            const updatedUser = await adminApi.updateUserRole(userId, newRole);
            setUsers((prev) =>
                prev.map((u) => (u.id === userId ? { ...u, role: updatedUser.role } : u))
            );
        } catch (error) {
            console.error('Failed to update role', error);
            alert('Failed to update user role.');
        } finally {
            setUpdatingParams(null);
        }
    };

    const submitBan = async () => {
        if (!banModalUser) return;
        setIsSubmittingBan(true);
        try {
            const bannedUntil = new Date();
            if (banDays === 'permanent') {
                bannedUntil.setFullYear(bannedUntil.getFullYear() + 100);
            } else {
                bannedUntil.setDate(bannedUntil.getDate() + parseInt(banDays));
            }

            const updatedUser = await adminApi.banUser(banModalUser.id, bannedUntil.toISOString(), banReason);
            setUsers(prev => prev.map(u => u.id === banModalUser.id ? updatedUser : u));
            setBanModalUser(null);
            setBanReason('');
        } catch (error) {
            console.error('Failed to ban user', error);
            alert('Failed to ban user');
        } finally {
            setIsSubmittingBan(false);
        }
    };

    const handleUnban = async (userId: number) => {
        if (!confirm('Are you sure you want to lift this ban?')) return;
        try {
            setUpdatingParams(userId);
            const updatedUser = await adminApi.unbanUser(userId);
            setUsers(prev => prev.map(u => u.id === userId ? updatedUser : u));
        } catch (error) {
            console.error('Failed to unban user', error);
            alert('Failed to unban user');
        } finally {
            setUpdatingParams(null);
        }
    };

    const submitPermissions = async () => {
        if (!permissionsModalUser) return;
        setIsSubmittingPermissions(true);
        try {
            const updatedUser = await adminApi.updateUserPermissions(permissionsModalUser.id, currentPermissions);
            setUsers(prev => prev.map(u => u.id === permissionsModalUser.id ? updatedUser : u));
            setPermissionsModalUser(null);
        } catch (error) {
            console.error('Failed to update permissions', error);
            alert('Failed to update permissions');
        } finally {
            setIsSubmittingPermissions(false);
        }
    };

    if (loading) {
        return <div className="text-white p-8">Loading users...</div>;
    }

    const filteredUsers = users.filter(u => {
        const matchSearch = !searchTerm ||
            u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchRole = roleFilter === 'all' || u.role === roleFilter;
        return matchSearch && matchRole;
    });

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-black text-white tracking-tighter uppercase flex items-center gap-3">
                    <Users className="w-8 h-8 text-purple-500" />
                    User Management
                </h1>
                <div className="flex items-center gap-4">
                    <div className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                        Total: {users.length} Users
                    </div>
                    <button
                        onClick={() => adminApi.exportUsersCsv()}
                        className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-lg font-bold uppercase tracking-wider text-xs flex items-center gap-2 transition-colors border border-white/10"
                    >
                        <Download className="w-4 h-4" /> Export CSV
                    </button>
                </div>
            </div>

            <div className="bg-[#111] border border-white/10 rounded-xl overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                    <span className="text-white font-bold text-base">Users ({filteredUsers.length})</span>
                </div>

                {/* Role filter pills */}
                <div className="px-6 py-3 border-b border-white/10 flex gap-1">
                    {(['all', 'admin', 'creator', 'viewer'] as const).map(r => (
                        <button
                            key={r}
                            onClick={() => setRoleFilter(r)}
                            className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${roleFilter === r ? 'bg-white text-black' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                        >
                            {r}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="px-6 py-3 border-b border-white/10">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search by username or email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 text-white rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-white/30 placeholder-gray-500"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-black/30 border-b border-white/5 text-xs font-bold uppercase tracking-widest text-gray-600">
                                <th className="p-4">User</th>
                                <th className="p-4">Email</th>
                                <th className="p-4 w-32 text-center">Status</th>
                                <th className="p-4 w-32 text-center">Role</th>
                                <th className="p-4 w-24 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredUsers.map((user) => {
                                const isBanned = user.banned_until && new Date(user.banned_until) > new Date();
                                return (
                                    <tr key={user.id} className={`hover:bg-white/[0.03] transition-colors ${isBanned ? 'opacity-60' : ''}`}>
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                                                    {user.avatar_url ? (
                                                        <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-xs font-bold text-gray-400">{user.username.substring(0, 2).toUpperCase()}</span>
                                                    )}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className={`font-bold ${isBanned ? 'text-red-400 line-through decoration-red-500/50' : 'text-white'}`}>{user.username}</span>
                                                    {isBanned && <span className="text-[10px] text-red-500 font-bold tracking-widest uppercase">Banned</span>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-gray-400">{user.email}</td>
                                        <td className="p-4 text-center">
                                            {isBanned ? (
                                                <div className="flex flex-col items-center gap-1 group relative">
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/30">
                                                        <Gavel className="w-3 h-3" /> Banned
                                                    </span>
                                                    {/* Tooltip for reason */}
                                                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#111] border border-red-500/30 w-48 p-2 rounded text-left opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 text-[10px] shadow-xl">
                                                        <p className="font-bold text-white mb-1">Reason:</p>
                                                        <p className="text-gray-400 mb-2 truncate">{user.ban_reason}</p>
                                                        <p className="font-bold text-white mb-1">Until:</p>
                                                        <p className="text-red-400 font-mono">{new Date(user.banned_until!).toLocaleDateString()}</p>
                                                    </div>
                                                </div>
                                            ) : user.is_active ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-500/10 text-green-500 border border-green-500/20">
                                                    <CheckCircle2 className="w-3 h-3" /> Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gray-500/10 text-gray-500 border border-gray-500/20">
                                                    <ShieldAlert className="w-3 h-3" /> Inactive
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-center">
                                            <select
                                                value={user.role}
                                                onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                                disabled={updatingParams === user.id}
                                                className={`
                                                px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider border outline-none cursor-pointer appearance-none text-center w-full
                                                ${updatingParams === user.id ? 'opacity-50 cursor-not-allowed' : ''}
                                                ${user.role === 'admin' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : ''}
                                                ${user.role === 'creator' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : ''}
                                                ${user.role === 'viewer' ? 'bg-white/5 text-gray-300 border-white/10' : ''}
                                            `}
                                            >
                                                <option value="viewer" className="bg-[#111] text-white">Viewer</option>
                                                <option value="creator" className="bg-[#111] text-white">Creator</option>
                                                <option value="admin" className="bg-[#111] text-white">Admin</option>
                                            </select>
                                        </td>
                                        <td className="p-4 text-center">
                                            {isBanned ? (
                                                <button
                                                    onClick={() => handleUnban(user.id)}
                                                    disabled={updatingParams === user.id}
                                                    className="p-1.5 rounded bg-green-500/10 text-green-500 hover:bg-green-500/20 transition-colors border border-green-500/20"
                                                    title="Unban User"
                                                >
                                                    <Unlock className="w-4 h-4" />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => setBanModalUser(user)}
                                                    disabled={updatingParams === user.id || user.role === 'admin'}
                                                    className={`p-1.5 rounded transition-colors border ${user.role === 'admin' ? 'opacity-30 cursor-not-allowed bg-white/5 border-white/10 text-gray-500' : 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20'}`}
                                                    title={user.role === 'admin' ? "Cannot ban admin" : "Ban User"}
                                                >
                                                    <Gavel className="w-4 h-4" />
                                                </button>
                                            )}

                                            <button
                                                onClick={() => {
                                                    setPermissionsModalUser(user);
                                                    setCurrentPermissions(user.permissions || {});
                                                }}
                                                disabled={updatingParams === user.id || user.role === 'admin'}
                                                className={`p-1.5 rounded transition-colors border ml-2 ${user.role === 'admin' ? 'opacity-30 cursor-not-allowed bg-white/5 border-white/10 text-gray-500' : 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20'}`}
                                                title={user.role === 'admin' ? "Admins have full access" : "Granular Permissions"}
                                            >
                                                <Shield className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                            {users.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-gray-500 font-bold uppercase tracking-widest">
                                        No users found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Ban Modal */}
            {banModalUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-[#111] border border-red-500/30 rounded-xl w-full max-w-md p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                                <Gavel className="w-6 h-6 text-red-500" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Suspend User</h3>
                                <p className="text-gray-400 text-sm font-bold">banning {banModalUser.username}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Ban Duration</label>
                                <select
                                    value={banDays}
                                    onChange={(e) => setBanDays(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-red-500 focus:outline-none transition-colors"
                                >
                                    <option value="1" className="bg-[#111]">1 Day (Warning)</option>
                                    <option value="7" className="bg-[#111]">7 Days</option>
                                    <option value="30" className="bg-[#111]">30 Days</option>
                                    <option value="permanent" className="bg-[#111]">Permanent</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Reason (Optional)</label>
                                <textarea
                                    value={banReason}
                                    onChange={(e) => setBanReason(e.target.value)}
                                    placeholder="Rule violation..."
                                    rows={3}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white placeholder-gray-600 focus:border-red-500 focus:outline-none transition-colors resize-none"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setBanModalUser(null)}
                                className="flex-1 px-4 py-2 rounded-lg font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors uppercase tracking-wider text-sm border border-white/5"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitBan}
                                disabled={isSubmittingBan}
                                className="flex-1 px-4 py-2 rounded-lg font-black text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors uppercase tracking-widest text-sm flex items-center justify-center gap-2"
                            >
                                {isSubmittingBan ? 'Processing...' : 'Hammer Down'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Permissions Modal */}
            {permissionsModalUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-[#111] border border-blue-500/30 rounded-xl w-full max-w-md p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                                <Shield className="w-6 h-6 text-blue-500" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Granular Permissions</h3>
                                <p className="text-gray-400 text-sm font-bold">editing {permissionsModalUser.username}</p>
                            </div>
                        </div>

                        <div className="space-y-3 bg-white/5 border border-white/10 rounded-lg p-4 mb-6">
                            {PERMISSION_KEYS.map((perm) => (
                                <label key={perm.key} className="flex items-center justify-between cursor-pointer group hover:bg-white/5 p-2 rounded transition-colors pr-4">
                                    <span className="text-sm font-bold text-gray-300 uppercase tracking-wider">{perm.label}</span>
                                    <div className="relative flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={!!currentPermissions[perm.key]}
                                            onChange={(e) => {
                                                setCurrentPermissions(prev => ({
                                                    ...prev,
                                                    [perm.key]: e.target.checked
                                                }));
                                            }}
                                            className="sr-only peer"
                                        />
                                        <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                                    </div>
                                </label>
                            ))}
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setPermissionsModalUser(null)}
                                className="flex-1 px-4 py-2 rounded-lg font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors uppercase tracking-wider text-sm border border-white/5"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitPermissions}
                                disabled={isSubmittingPermissions}
                                className="flex-1 px-4 py-2 rounded-lg font-black text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors uppercase tracking-widest text-sm flex items-center justify-center gap-2"
                            >
                                {isSubmittingPermissions ? 'Saving...' : 'Save Permissions'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
