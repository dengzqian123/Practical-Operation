import { useState, useEffect } from 'react';
import {
  Key, Plus, Trash2, Eye, EyeOff, Check, AlertCircle,
  Loader2, ExternalLink, Shield, RefreshCw, X, ChevronDown,
  Users, UserCheck, ChevronRight,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { UserApiKey, Profile } from '../lib/database.types';

export interface ModelDef {
  id: string;
  name: string;
  description: string;
  type: 't2v' | 'i2v' | 'r2v' | 'v2v' | 'img';
  hidden?: boolean;
}

export interface ProviderDef {
  id: string;
  name: string;
  region: string;
  dashscopeRegion?: string;
  color: string;
  models: ModelDef[];
  docsUrl: string;
  keyFormat: string;
  keyPlaceholder: string;
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: 'aliyun',
    name: '阿里云百炼',
    region: '阿里巴巴',
    dashscopeRegion: 'intl',
    color: 'from-orange-400/20 to-yellow-500/20 border-orange-400/30',
    models: [
      { id: 'happyhorse-1.0-t2v', name: 'HappyHorse-1.0-T2V', description: 'HappyHorse文生视频，物理真实、运动流畅', type: 't2v' },
      { id: 'happyhorse-1.0-i2v', name: 'HappyHorse-1.0-I2V', description: 'HappyHorse图生视频（首帧），高度还原动态画面', type: 'i2v' },
      { id: 'happyhorse-1.0-r2v', name: 'HappyHorse-1.0-R2V', description: 'HappyHorse参考图生视频，多张参考图融合生成', type: 'r2v' },
      { id: 'happyhorse-1.0-video-edit', name: 'HappyHorse-1.0-VideoEdit', description: 'HappyHorse视频编辑，输入视频+参考图进行内容修改', type: 'v2v' },
      { id: 'wan2.7-image-pro', name: 'Wan2.7-Image-Pro', description: '万相图像生成与编辑2.7 Pro，支持4K文生图', type: 'img' },
      { id: 'wan2.7-image', name: 'Wan2.7-Image', description: '万相图像生成与编辑2.7，支持2K生成', type: 'img' },
      { id: 'wan2.7-t2v-2026-04-25', name: 'Wan2.7-T2V (2026-04-25)', description: '万相2.7文生视频，演绎能力全面升级', type: 't2v', hidden: true },
      { id: 'wan2.7-i2v', name: 'Wan2.7-I2V', description: '万相2.7图生视频，文戏情感细腻', type: 'i2v', hidden: true },
      { id: 'wan2.6-i2v-flash', name: 'Wan2.6-I2V-Flash', description: '万相2.6图生视频Flash，生成更快更高性价比', type: 'i2v', hidden: true },
      { id: 'wan2.6-i2v', name: 'Wan2.6-I2V', description: '万相2.6图生视频，智能分镜调度支持多镜头叙事', type: 'i2v', hidden: true },
      { id: 'wan2.5-i2v-preview', name: 'Wan2.5-I2V-Preview', description: '万相2.5图生视频Preview，全新升级技术架构', type: 'i2v', hidden: true },
      { id: 'wan2.2-i2v-plus', name: 'Wan2.2-I2V-Plus', description: '万相2.2图生视频，视频品质更高', type: 'i2v', hidden: true },
    ],
    docsUrl: 'https://help.aliyun.com/zh/model-studio/happyhorse-text-to-video-api-reference',
    keyFormat: 'API Key (sk- 开头)',
    keyPlaceholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxx',
  },
];

const LS_KEY_PREFIX = 'frameforge_apikey_';

function getStoredKey(provider: string): string {
  return localStorage.getItem(LS_KEY_PREFIX + provider) || '';
}

function storeKey(provider: string, key: string) {
  if (key) {
    localStorage.setItem(LS_KEY_PREFIX + provider, key);
  } else {
    localStorage.removeItem(LS_KEY_PREFIX + provider);
  }
}

// ─── Admin: assign/edit key for a specific user ───────────────────────────────

interface AssignKeyModalProps {
  provider: ProviderDef;
  targetUser: Profile;
  existingRecord: UserApiKey | null;
  onSave: (record: UserApiKey) => void;
  onClose: () => void;
}

function AssignKeyModal({ provider, targetUser, existingRecord, onSave, onClose }: AssignKeyModalProps) {
  const [apiKey, setApiKey] = useState(existingRecord?.full_key || '');
  const [label, setLabel] = useState(existingRecord?.label || provider.name);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!apiKey.trim()) { setError('请输入 API Key'); return; }
    if (!label.trim()) { setError('请输入名称'); return; }
    setSaving(true);
    setError('');

    const trimmedKey = apiKey.trim();
    const hint = trimmedKey.length > 4 ? '...' + trimmedKey.slice(-4) : '****';

    const payload = {
      user_id: targetUser.id,
      provider: provider.id,
      label: label.trim(),
      api_key_hint: hint,
      full_key: trimmedKey,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (existingRecord) {
      const { data } = await supabase
        .from('user_api_keys')
        .update({ label: payload.label, api_key_hint: payload.api_key_hint, full_key: payload.full_key, updated_at: payload.updated_at })
        .eq('id', existingRecord.id)
        .select()
        .maybeSingle();
      result = data;
    } else {
      const { data } = await supabase
        .from('user_api_keys')
        .insert(payload)
        .select()
        .maybeSingle();
      result = data;
    }

    setSaving(false);
    if (result) onSave(result);
    else setError('保存失败，请重试');
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${provider.color} flex items-center justify-center`}>
              <Key size={14} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">{provider.name}</div>
              <div className="text-xs text-gray-500">分配给：{targetUser.display_name || targetUser.username || targetUser.id.slice(0, 8)}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">名称标签</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="例如：个人账号、公司账号"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-300">API Key</label>
              <a href={provider.docsUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
                获取 Key <ExternalLink size={10} />
              </a>
            </div>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={provider.keyPlaceholder}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 pr-12 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors font-mono"
              />
              <button type="button" onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors">
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1.5">格式：{provider.keyFormat}</p>
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-5">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-white font-medium text-sm rounded-xl transition-all">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {existingRecord ? '更新 Key' : '分配 Key'}
          </button>
          <button onClick={onClose}
            className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-xl transition-colors">
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Admin: user assignment panel ─────────────────────────────────────────────

interface UserAssignmentPanelProps {
  allKeys: UserApiKey[];
  onKeysChanged: (keys: UserApiKey[]) => void;
}

function UserAssignmentPanel({ allKeys, onKeysChanged }: UserAssignmentPanelProps) {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [assignModal, setAssignModal] = useState<{ user: Profile; provider: ProviderDef; record: UserApiKey | null } | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('display_name');
    setUsers((data || []).filter((u) => u.role !== 'admin'));
    setLoading(false);
  };

  const getUserKeys = (userId: string) =>
    allKeys.filter((k) => k.user_id === userId);

  const getUserProviderKey = (userId: string, providerId: string) =>
    allKeys.find((k) => k.user_id === userId && k.provider === providerId) || null;

  const handleSaved = (record: UserApiKey) => {
    const updated = allKeys.find((k) => k.id === record.id)
      ? allKeys.map((k) => (k.id === record.id ? record : k))
      : [...allKeys, record];
    onKeysChanged(updated);
    setAssignModal(null);
  };

  const handleDelete = async (record: UserApiKey) => {
    await supabase.from('user_api_keys').delete().eq('id', record.id);
    onKeysChanged(allKeys.filter((k) => k.id !== record.id));
  };

  const handleToggleActive = async (record: UserApiKey) => {
    await supabase.from('user_api_keys')
      .update({ is_active: !record.is_active, updated_at: new Date().toISOString() })
      .eq('id', record.id);
    onKeysChanged(allKeys.map((k) => k.id === record.id ? { ...k, is_active: !k.is_active } : k));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 text-sm">暂无普通用户</div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {users.map((u) => {
          const keys = getUserKeys(u.id);
          const activeCount = keys.filter((k) => k.is_active).length;
          const isExpanded = expandedUser === u.id;

          return (
            <div key={u.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <button
                onClick={() => setExpandedUser(isExpanded ? null : u.id)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-800/40 transition-colors"
              >
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0 text-xs font-medium text-gray-300">
                  {(u.display_name || u.username || '?')[0].toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">
                      {u.display_name || u.username || u.id.slice(0, 8)}
                    </span>
                    {u.username && u.display_name && (
                      <span className="text-xs text-gray-500">@{u.username}</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {activeCount > 0
                      ? `${activeCount} 个服务商已配置`
                      : '尚未分配任何 Key'}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {activeCount > 0 && (
                    <span className="flex items-center gap-1 text-xs text-emerald-400">
                      <UserCheck size={12} />
                      {activeCount}/{PROVIDERS.length}
                    </span>
                  )}
                  <ChevronRight size={14} className={`text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-800 pt-3 space-y-2">
                  {PROVIDERS.map((provider) => {
                    const record = getUserProviderKey(u.id, provider.id);
                    return (
                      <div key={provider.id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors
                          ${record?.is_active ? 'bg-emerald-500/5 border-emerald-500/15' : 'bg-gray-800/50 border-gray-700/50'}`}>
                        <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${provider.color} flex items-center justify-center flex-shrink-0`}>
                          <Key size={12} className="text-white" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-white">{provider.name}</div>
                          {record ? (
                            <div className="text-xs text-gray-500 mt-0.5">
                              {record.label} · {record.api_key_hint}
                              {record.is_active
                                ? <span className="text-emerald-400 ml-1">启用</span>
                                : <span className="text-gray-500 ml-1">停用</span>}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-600 mt-0.5">未分配</div>
                          )}
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          {record && (
                            <>
                              <button
                                onClick={() => handleToggleActive(record)}
                                title={record.is_active ? '停用' : '启用'}
                                className={`p-1.5 rounded-lg transition-colors ${record.is_active ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-gray-500 hover:bg-gray-700'}`}>
                                <RefreshCw size={12} />
                              </button>
                              <button
                                onClick={() => setAssignModal({ user: u, provider, record })}
                                title="修改 Key"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
                                <Key size={12} />
                              </button>
                              <button
                                onClick={() => handleDelete(record)}
                                title="删除"
                                className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                                <Trash2 size={12} />
                              </button>
                            </>
                          )}
                          {!record && (
                            <button
                              onClick={() => setAssignModal({ user: u, provider, record: null })}
                              className="flex items-center gap-1 px-2.5 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 text-xs rounded-lg transition-all">
                              <Plus size={11} />
                              分配
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {assignModal && (
        <AssignKeyModal
          provider={assignModal.provider}
          targetUser={assignModal.user}
          existingRecord={assignModal.record}
          onSave={handleSaved}
          onClose={() => setAssignModal(null)}
        />
      )}
    </>
  );
}

// ─── Admin: own key management (same as before) ───────────────────────────────

interface AddKeyModalProps {
  provider: ProviderDef;
  existingRecord: UserApiKey | null;
  onSave: (record: UserApiKey) => void;
  onClose: () => void;
  userId: string;
}

function AddKeyModal({ provider, existingRecord, onSave, onClose, userId }: AddKeyModalProps) {
  const [apiKey, setApiKey] = useState(
    existingRecord ? (getStoredKey(provider.id) || existingRecord.full_key || '') : ''
  );
  const [label, setLabel] = useState(existingRecord?.label || provider.name);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!apiKey.trim()) { setError('请输入 API Key'); return; }
    if (!label.trim()) { setError('请输入名称'); return; }
    setSaving(true);
    setError('');

    const trimmedKey = apiKey.trim();
    const hint = trimmedKey.length > 4 ? '...' + trimmedKey.slice(-4) : '****';
    storeKey(provider.id, trimmedKey);

    const payload = {
      user_id: userId,
      provider: provider.id,
      label: label.trim(),
      api_key_hint: hint,
      full_key: trimmedKey,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (existingRecord) {
      const { data } = await supabase
        .from('user_api_keys')
        .update({ label: payload.label, api_key_hint: payload.api_key_hint, full_key: payload.full_key, updated_at: payload.updated_at })
        .eq('id', existingRecord.id)
        .select()
        .maybeSingle();
      result = data;
    } else {
      const { data } = await supabase
        .from('user_api_keys')
        .insert(payload)
        .select()
        .maybeSingle();
      result = data;
    }

    setSaving(false);
    if (result) onSave(result);
    else setError('保存失败，请重试');
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${provider.color} flex items-center justify-center`}>
              <Key size={14} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">{provider.name}</div>
              <div className="text-xs text-gray-500">{provider.region}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">名称标签</label>
            <input type="text" value={label} onChange={(e) => setLabel(e.target.value)}
              placeholder="例如：个人账号、公司账号"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-300">API Key</label>
              <a href={provider.docsUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
                获取 Key <ExternalLink size={10} />
              </a>
            </div>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={provider.keyPlaceholder}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 pr-12 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors font-mono"
              />
              <button type="button" onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors">
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1.5">格式：{provider.keyFormat}</p>
          </div>

          <div className="p-3 rounded-xl bg-gray-800/60 border border-gray-700">
            <div className="flex items-start gap-2">
              <Shield size={13} className="text-cyan-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-gray-400 leading-relaxed">
                API Key 将通过加密连接保存至您的账号，登录任意设备后均可自动同步。数据库访问受 RLS 策略保护，仅您本人可读取。
              </p>
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-gray-400 mb-2">支持的模型</div>
            <div className="space-y-1.5">
              {provider.models.filter((m) => !m.hidden).map((m) => (
                <div key={m.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700/50">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
                  <span className="text-xs font-medium text-white">{m.name}</span>
                  <span className="text-xs text-gray-500">{m.description}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-5">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-white font-medium text-sm rounded-xl transition-all">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {existingRecord ? '更新 Key' : '保存 Key'}
          </button>
          <button onClick={onClose}
            className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-xl transition-colors">
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function ApiKeysPage() {
  const { user, isAdmin } = useAuth();
  const [records, setRecords] = useState<UserApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalProvider, setModalProvider] = useState<ProviderDef | null>(null);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [adminTab, setAdminTab] = useState<'own' | 'users'>('own');

  useEffect(() => {
    if (user) loadKeys();
  }, [user]);

  const loadKeys = async () => {
    setLoading(true);
    // Admin fetches all keys (RLS allows it); regular users only see their own
    const query = supabase.from('user_api_keys').select('*');
    const { data } = isAdmin
      ? await query
      : await query.eq('user_id', user!.id);
    const rows = data || [];
    // Sync own keys into localStorage
    for (const row of rows) {
      if (row.user_id === user!.id && row.full_key && !getStoredKey(row.provider)) {
        storeKey(row.provider, row.full_key);
      }
    }
    setRecords(rows);
    setLoading(false);
  };

  const ownRecords = records.filter((r) => r.user_id === user!.id);
  const getRecord = (providerId: string) =>
    ownRecords.find((r) => r.provider === providerId) || null;

  const handleSaved = (record: UserApiKey) => {
    setRecords((prev) => {
      const exists = prev.find((r) => r.id === record.id);
      return exists ? prev.map((r) => (r.id === record.id ? record : r)) : [...prev, record];
    });
    setModalProvider(null);
  };

  const deleteKey = async (record: UserApiKey) => {
    await supabase.from('user_api_keys').delete().eq('id', record.id);
    storeKey(record.provider, '');
    setRecords((prev) => prev.filter((r) => r.id !== record.id));
  };

  const toggleActive = async (record: UserApiKey) => {
    await supabase.from('user_api_keys')
      .update({ is_active: !record.is_active, updated_at: new Date().toISOString() })
      .eq('id', record.id);
    setRecords((prev) => prev.map((r) => r.id === record.id ? { ...r, is_active: !r.is_active } : r));
  };

  const configured = ownRecords.filter((r) => r.is_active).length;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">API 密钥管理</h1>
        <p className="text-gray-400 text-sm mt-1">
          {isAdmin ? '配置服务商 API Key，并为用户分配访问权限' : '配置各云厂商 API Key，视频生成将通过对应服务调用'}
        </p>
      </div>

      {/* Admin tab switcher */}
      {isAdmin && (
        <div className="flex gap-1 p-1 bg-gray-900 border border-gray-800 rounded-xl mb-6">
          <button
            onClick={() => setAdminTab('own')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-colors
              ${adminTab === 'own' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <Key size={14} />
            我的 Key
          </button>
          <button
            onClick={() => setAdminTab('users')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-colors
              ${adminTab === 'users' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <Users size={14} />
            用户分配
          </button>
        </div>
      )}

      {/* Own keys tab */}
      {adminTab === 'own' && (
        <>
          {/* Status bar */}
          <div className="flex items-center gap-4 p-4 bg-gray-900 border border-gray-800 rounded-2xl mb-6">
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${configured > 0 ? 'bg-emerald-400' : 'bg-gray-600'}`} />
            <div>
              <div className="text-sm font-medium text-white">
                {configured > 0 ? `${configured} 个服务商已配置` : '尚未配置任何 API Key'}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {configured > 0 ? '生成视频时将使用已配置的服务商' : '请至少配置一个服务商以开始生成视频'}
              </div>
            </div>
            {loading && <Loader2 size={16} className="animate-spin text-gray-400 ml-auto" />}
          </div>

          {/* Security notice */}
          <div className="flex items-start gap-3 p-4 bg-cyan-500/5 border border-cyan-500/15 rounded-2xl mb-6">
            <Shield size={16} className="text-cyan-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-sm font-medium text-cyan-300 mb-0.5">账号云端同步</div>
              <p className="text-xs text-gray-400 leading-relaxed">
                API Key 保存至您的账号并通过 HTTPS 加密传输，登录任意设备后将自动同步到本地。数据访问受 RLS 策略保护，仅您本人可读取。
              </p>
            </div>
          </div>

          {/* Provider list */}
          <div className="space-y-3">
            {PROVIDERS.map((provider) => {
              const record = getRecord(provider.id);
              const hasKey = !!record;
              const isExpanded = expandedProvider === provider.id;

              return (
                <div key={provider.id}
                  className={`bg-gray-900 border rounded-2xl overflow-hidden transition-all duration-200
                    ${hasKey && record.is_active ? 'border-emerald-500/20' : 'border-gray-800'}`}>
                  <div className="flex items-center gap-4 p-4">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${provider.color} flex items-center justify-center flex-shrink-0`}>
                      <Key size={16} className="text-white" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">{provider.name}</span>
                        <span className="text-xs text-gray-500">{provider.region}</span>
                        {hasKey && record.is_active && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/20 text-emerald-400">已配置</span>
                        )}
                        {hasKey && !record.is_active && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-700 border border-gray-600 text-gray-400">已停用</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {hasKey
                          ? `Key: ${record.label} · ${record.api_key_hint}`
                          : `${provider.models.filter((m) => !m.hidden).length} 个模型可用`}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {hasKey && (
                        <>
                          <button onClick={() => toggleActive(record)}
                            className={`p-2 rounded-lg text-xs transition-colors ${record.is_active ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-gray-500 hover:bg-gray-700'}`}
                            title={record.is_active ? '停用' : '启用'}>
                            <RefreshCw size={14} />
                          </button>
                          <button onClick={() => setModalProvider(provider)}
                            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors" title="更新 Key">
                            <Key size={14} />
                          </button>
                          <button onClick={() => deleteKey(record)}
                            className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="删除">
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                      {!hasKey && (
                        <button onClick={() => setModalProvider(provider)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 text-xs font-medium rounded-xl transition-all">
                          <Plus size={12} />
                          配置
                        </button>
                      )}
                      <button onClick={() => setExpandedProvider(isExpanded ? null : provider.id)}
                        className="p-2 rounded-lg text-gray-500 hover:text-gray-300 transition-colors">
                        <ChevronDown size={14} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-800 pt-3">
                      <div className="text-xs font-medium text-gray-400 mb-2">支持的模型</div>
                      <div className="space-y-1.5">
                        {provider.models.filter((m) => !m.hidden).map((m) => (
                          <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-800/60 border border-gray-700/50">
                            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-medium text-white">{m.name}</span>
                              <span className="text-xs text-gray-500 ml-2">{m.description}</span>
                            </div>
                            {hasKey && record.is_active && (
                              <span className="text-xs text-emerald-400 flex items-center gap-1">
                                <Check size={10} /> 可用
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      <a href={provider.docsUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 mt-3 text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
                        查看官方文档 <ExternalLink size={11} />
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* User assignment tab (admin only) */}
      {isAdmin && adminTab === 'users' && (
        <>
          <div className="flex items-start gap-3 p-4 bg-amber-500/5 border border-amber-500/15 rounded-2xl mb-6">
            <Users size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-sm font-medium text-amber-300 mb-0.5">用户 Key 分配</div>
              <p className="text-xs text-gray-400 leading-relaxed">
                在此为每位用户分配服务商 API Key。分配后用户即可使用对应模型生成内容，用户无法自行查看或修改 Key。
              </p>
            </div>
          </div>

          <UserAssignmentPanel
            allKeys={records.filter((r) => r.user_id !== user!.id)}
            onKeysChanged={(updated) =>
              setRecords((prev) => [
                ...prev.filter((r) => r.user_id === user!.id),
                ...updated,
              ])
            }
          />
        </>
      )}

      {/* Modal for own key */}
      {modalProvider && user && (
        <AddKeyModal
          provider={modalProvider}
          existingRecord={getRecord(modalProvider.id)}
          onSave={handleSaved}
          onClose={() => setModalProvider(null)}
          userId={user.id}
        />
      )}
    </div>
  );
}
