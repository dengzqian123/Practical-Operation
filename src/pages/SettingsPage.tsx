import { useState } from 'react';
import { Bell, Shield, Palette, Zap, ChevronRight, Check, LogOut, Key } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

type Page = 'dashboard' | 'generate' | 'works' | 'projects' | 'explore' | 'apikeys' | 'settings' | 'profile';

interface SettingsPageProps {
  onNavigate?: (page: Page) => void;
}

interface ToggleProps {
  enabled: boolean;
  onChange: () => void;
}

function Toggle({ enabled, onChange }: ToggleProps) {
  return (
    <button
      onClick={onChange}
      className={`w-11 h-6 rounded-full transition-all flex items-center px-0.5 ${enabled ? 'bg-cyan-500' : 'bg-gray-700'}`}
    >
      <div className={`w-5 h-5 rounded-full bg-white transition-all ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-gray-800 last:border-0">
      <div>
        <div className="text-sm font-medium text-white">{label}</div>
        {description && <div className="text-xs text-gray-500 mt-0.5">{description}</div>}
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage({ onNavigate }: SettingsPageProps) {
  const { signOut } = useAuth();
  const [prefs, setPrefs] = useState({
    emailNotifs: true,
    generationAlerts: true,
    marketingEmails: false,
    publicProfile: true,
    autoSave: true,
    hdDefault: false,
    showWatermark: false,
  });

  const toggle = (key: keyof typeof prefs) =>
    setPrefs((p) => ({ ...p, [key]: !p[key] }));

  const sections = [
    {
      title: 'Notifications',
      icon: Bell,
      items: [
        { key: 'emailNotifs' as const, label: 'Email Notifications', description: 'Receive emails about your account activity' },
        { key: 'generationAlerts' as const, label: 'Generation Alerts', description: 'Get notified when your video is ready' },
        { key: 'marketingEmails' as const, label: 'Marketing Emails', description: 'Tips, updates, and feature announcements' },
      ],
    },
    {
      title: 'Privacy',
      icon: Shield,
      items: [
        { key: 'publicProfile' as const, label: 'Public Profile', description: 'Allow others to discover your profile' },
      ],
    },
    {
      title: 'Generation Defaults',
      icon: Zap,
      items: [
        { key: 'autoSave' as const, label: 'Auto-save to Works', description: 'Automatically save all generated videos' },
        { key: 'hdDefault' as const, label: 'Default to 4K', description: 'Use 4K resolution by default' },
        { key: 'showWatermark' as const, label: 'Hide Watermark', description: 'Remove FrameForge watermark from exports' },
      ],
    },
  ];

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Settings</h1>

      <div className="space-y-6">
        {sections.map(({ title, icon: Icon, items }) => (
          <div key={title} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Icon size={16} className="text-cyan-400" />
              <h2 className="font-semibold text-white">{title}</h2>
            </div>
            <div>
              {items.map(({ key, label, description }) => (
                <SettingRow key={key} label={label} description={description}>
                  <Toggle enabled={prefs[key]} onChange={() => toggle(key)} />
                </SettingRow>
              ))}
            </div>
          </div>
        ))}

        {/* Appearance */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Palette size={16} className="text-cyan-400" />
            <h2 className="font-semibold text-white">Appearance</h2>
          </div>
          <div className="space-y-3">
            <div className="text-sm font-medium text-gray-300 mb-3">Theme</div>
            <div className="flex gap-3">
              {['Dark', 'Light', 'System'].map((t) => (
                <button
                  key={t}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all
                    ${t === 'Dark' ? 'bg-gray-700 text-white border-gray-600' : 'text-gray-400 border-gray-700 hover:border-gray-600'}`}
                >
                  {t === 'Dark' && <Check size={12} className="inline mr-1" />}
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* API Keys shortcut */}
        <div
          onClick={() => onNavigate?.('apikeys')}
          className="flex items-center gap-4 p-5 bg-gray-900 border border-gray-800 rounded-2xl hover:border-cyan-500/30 cursor-pointer transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
            <Key size={18} className="text-cyan-400" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-white">API Key 管理</div>
            <div className="text-xs text-gray-500 mt-0.5">配置云厂商大模型服务的 API Key</div>
          </div>
          <ChevronRight size={16} className="text-gray-500 group-hover:text-cyan-400 transition-colors" />
        </div>

        {/* Account actions */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="font-semibold text-white mb-4">Account</h2>
          <div className="space-y-1">
            <button className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-gray-800 text-sm text-gray-300 transition-colors">
              <span>Change Password</span>
              <ChevronRight size={15} className="text-gray-500" />
            </button>
            <button className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-gray-800 text-sm text-gray-300 transition-colors">
              <span>Export My Data</span>
              <ChevronRight size={15} className="text-gray-500" />
            </button>
            <button className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-red-500/10 text-sm text-red-400 transition-colors">
              <span>Delete Account</span>
              <ChevronRight size={15} className="text-red-500" />
            </button>
          </div>
        </div>

        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm font-medium rounded-2xl transition-colors"
        >
          <LogOut size={15} />
          Sign Out
        </button>
      </div>
    </div>
  );
}
