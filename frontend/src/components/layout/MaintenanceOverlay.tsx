import { ShieldAlert } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';

export default function MaintenanceOverlay() {
    const { settings } = useSettings();

    if (!settings?.maintenance_mode) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full text-center space-y-6">
                <div className="w-24 h-24 bg-red-500/10 border border-red-500/20 rounded-2xl mx-auto flex items-center justify-center">
                    <ShieldAlert className="w-12 h-12 text-red-500" />
                </div>

                <h1 className="text-4xl font-black text-white uppercase tracking-tighter">
                    Under Maintenance
                </h1>

                <p className="text-gray-400 font-medium">
                    {settings?.site_name || 'AniFlow'} is currently undergoing scheduled maintenance.
                    Our engineering team is deploying a new update. Please check back later!
                </p>

                <div className="pt-8">
                    <div className="w-12 h-1 bg-gradient-to-r from-red-500 to-red-900 mx-auto rounded-full"></div>
                </div>
            </div>
        </div>
    );
}
