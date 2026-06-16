import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Video, ChevronDown, Plus, Trash2, Clock, Zap, Film, Loader2, Check, AlertCircle, Wand2, RefreshCw, Download, Key, ExternalLink, Copy, Hash, Activity, Upload, X, Image as ImageIcon, FolderOpen, Layers, Pencil, GripVertical, Timer } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Conversation, Message, Video as VideoType, Project } from '../lib/database.types';
import { PROVIDERS } from './ApiKeysPage';

const DURATIONS = [3, 5, 8, 10, 15];
const RESOLUTIONS: { value: string; label: string }[] = [
  { value: '720P', label: '720P' },
  { value: '1080P', label: '1080P' },
];
const RATIOS: { value: string; label: string }[] = [
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '1:1', label: '1:1' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
  { value: '4:5', label: '4:5' },
  { value: '5:4', label: '5:4' },
  { value: '9:21', label: '9:21' },
  { value: '21:9', label: '21:9' },
];

const EXAMPLE_PROMPTS = [
  '一名宇航员在火星广阔的红色荒原上漫步，夕阳西下，脚边沙尘飞扬',
  '樱花树延时盛开，花瓣如粉色雪花纷纷飘落，画面唯美',
  '深海发光城市，异形鱼群穿梭在水晶塔楼间，流光溢彩',
  '蒸汽朋克飞艇翱翔在维多利亚时代的伦敦晨雾上空',
];

const THUMBNAIL_IMAGES = [
  'https://images.pexels.com/photos/1670977/pexels-photo-1670977.jpeg?auto=compress&cs=tinysrgb&w=400&h=225&fit=crop',
  'https://images.pexels.com/photos/2387418/pexels-photo-2387418.jpeg?auto=compress&cs=tinysrgb&w=400&h=225&fit=crop',
  'https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=400&h=225&fit=crop',
  'https://images.pexels.com/photos/1205301/pexels-photo-1205301.jpeg?auto=compress&cs=tinysrgb&w=400&h=225&fit=crop',
  'https://images.pexels.com/photos/956981/pexels-photo-956981.jpeg?auto=compress&cs=tinysrgb&w=400&h=225&fit=crop',
];

interface ModelOption {
  id: string;
  name: string;
  providerName: string;
  providerId: string;
  description: string;
  keyHint: string;
  modelType: 't2v' | 'i2v' | 'r2v' | 'v2v' | 'img';
  dashscopeRegion?: string;
}

interface ConversationWithMessages extends Conversation {
  messages: (Message & { video?: VideoType; batchVideos?: VideoType[] })[];
}

export default function GeneratePage() {
  const { user, profile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<ConversationWithMessages | null>(null);
  const [inputText, setInputText] = useState('');
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelOption | null>(null);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [duration, setDuration] = useState(() => Number(localStorage.getItem('frameforge_duration') || '5'));
  const [resolution, setResolution] = useState(() => localStorage.getItem('frameforge_resolution') || '720P');
  const [ratio, setRatio] = useState(() => localStorage.getItem('frameforge_ratio') || '16:9');
  const [watermark, setWatermark] = useState(() => localStorage.getItem('frameforge_watermark') === 'true');
  const [imgSize, setImgSize] = useState<'1K' | '2K' | '4K'>(() => (localStorage.getItem('frameforge_img_size') as '1K' | '2K' | '4K') || '2K');
  const [imgN, setImgN] = useState(() => Number(localStorage.getItem('frameforge_img_n') || '1'));
  const [batchCount, setBatchCount] = useState(() => Math.min(5, Number(localStorage.getItem('frameforge_batch_count') || '1')));
  const [multiPromptMode, setMultiPromptMode] = useState(false);
  const [multiPrompts, setMultiPrompts] = useState<string[]>(['', '']);
  const [multiI2vImages, setMultiI2vImages] = useState<string[]>([]);
  const [multiI2vUploading, setMultiI2vUploading] = useState<number | null>(null);
  const [multiR2vImages, setMultiR2vImages] = useState<string[][]>([]);
  const [multiR2vUploading, setMultiR2vUploading] = useState<number | null>(null);
  const [multiPromptRunningConvIds, setMultiPromptRunningConvIds] = useState<Set<string>>(new Set());
  const multiPromptRunning = activeConv ? multiPromptRunningConvIds.has(activeConv.id) : false;
  const setMultiPromptRunning = (convId: string, value: boolean) =>
    setMultiPromptRunningConvIds((prev) => { const n = new Set(prev); value ? n.add(convId) : n.delete(convId); return n; });
  const [multiPromptProgress, setMultiPromptProgress] = useState<{ index: number; status: 'pending' | 'running' | 'done' | 'failed' }[]>([]);
  const [generatingConvIds, setGeneratingConvIds] = useState<Set<string>>(new Set());
  // True only when the currently active conversation is generating — lets other convs submit freely
  const generating = activeConv ? generatingConvIds.has(activeConv.id) : false;
  const setGenerating = (convId: string, value: boolean) =>
    setGeneratingConvIds((prev) => {
      const next = new Set(prev);
      if (value) next.add(convId); else next.delete(convId);
      return next;
    });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(() => localStorage.getItem('frameforge_project_id'));
  const [keysLoading, setKeysLoading] = useState(true);
  const [imageUrl, setImageUrl] = useState('');
  const [imageMode, setImageMode] = useState<'url' | 'upload'>('url');
  const [uploadedImageUrl, setUploadedImageUrl] = useState('');
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState('');
  const imageFileRef = useRef<HTMLInputElement>(null);
  const [videoEditUrl, setVideoEditUrl] = useState('');
  const [videoEditMode, setVideoEditMode] = useState<'url' | 'upload'>('url');
  const [uploadedVideoEditUrl, setUploadedVideoEditUrl] = useState('');
  const [videoEditUploading, setVideoEditUploading] = useState(false);
  const [videoEditUploadError, setVideoEditUploadError] = useState('');
  const videoEditFileRef = useRef<HTMLInputElement>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (user) {
      loadApiKeys();
      loadConversations();
      loadProjects();
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('video-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'videos', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const updated = payload.new as VideoType;
          setActiveConv((prev) => {
            if (!prev) return prev;
            const messages = prev.messages.map((m) => {
              if (m.video?.id === updated.id) {
                return { ...m, video: { ...m.video, ...updated } };
              }
              if (m.batchVideos?.some((v) => v.id === updated.id)) {
                return {
                  ...m,
                  batchVideos: m.batchVideos!.map((v) => v.id === updated.id ? { ...v, ...updated } : v),
                };
              }
              return m;
            });
            return { ...prev, messages };
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConv?.messages]);

  useEffect(() => { localStorage.setItem('frameforge_duration', String(duration)); }, [duration]);
  useEffect(() => { localStorage.setItem('frameforge_resolution', resolution); }, [resolution]);
  useEffect(() => { localStorage.setItem('frameforge_ratio', ratio); }, [ratio]);
  useEffect(() => { localStorage.setItem('frameforge_watermark', String(watermark)); }, [watermark]);
  useEffect(() => { localStorage.setItem('frameforge_img_size', imgSize); }, [imgSize]);
  useEffect(() => {
    if (imgSize === '4K' && (imageUrl.trim() || uploadedImageUrl || uploadedImageUrls.length > 0)) {
      setImgSize('2K');
    }
  }, [imageUrl, uploadedImageUrl, uploadedImageUrls]);
  useEffect(() => { localStorage.setItem('frameforge_batch_count', String(batchCount)); }, [batchCount]);
  useEffect(() => { localStorage.setItem('frameforge_img_n', String(imgN)); }, [imgN]);
  useEffect(() => {
    if (selectedProjectId) localStorage.setItem('frameforge_project_id', selectedProjectId);
    else localStorage.removeItem('frameforge_project_id');
  }, [selectedProjectId]);

  const loadApiKeys = async () => {
    setKeysLoading(true);
    const { data: keyRecords } = await supabase
      .from('user_api_keys')
      .select('*')
      .eq('user_id', user!.id)
      .eq('is_active', true);

    const models: ModelOption[] = [];
    for (const record of keyRecords || []) {
      const provider = PROVIDERS.find((p) => p.id === record.provider);
      if (!provider) continue;
      // Sync full_key from DB to localStorage when not present locally (cross-device sync)
      if (record.full_key && !localStorage.getItem(LS_KEY(provider.id))) {
        localStorage.setItem(LS_KEY(provider.id), record.full_key);
      }
      for (const model of provider.models) {
        if (model.hidden) continue;
        models.push({
          id: model.id,
          name: model.name,
          providerName: provider.name,
          providerId: provider.id,
          description: model.description,
          keyHint: record.api_key_hint,
          modelType: model.type,
          dashscopeRegion: provider.dashscopeRegion,
        });
      }
    }

    setAvailableModels(models);
    if (models.length > 0) {
      const savedModelId = localStorage.getItem('frameforge_last_model');
      const restored = savedModelId ? models.find((m) => m.id === savedModelId) : null;
      if (!selectedModel) setSelectedModel(restored || models[0]);
    }
    setKeysLoading(false);
  };

  const loadConversations = async () => {
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .order('sort_order', { ascending: true });
    if (data) setConversations(data);
  };

  const loadProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('id, name')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });
    if (data) {
      setProjects(data as Project[]);
      // If saved project no longer exists, clear it
      const savedId = localStorage.getItem('frameforge_project_id');
      if (savedId && !data.find((p) => p.id === savedId)) {
        setSelectedProjectId(null);
      }
    }
  };

  const loadConversation = async (convId: string) => {
    const { data: conv } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', convId)
      .maybeSingle();

    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });

    if (conv) {
      const messagesWithVideos = await Promise.all(
        (msgs || []).map(async (msg) => {
          const msgMeta = msg.metadata as Record<string, unknown> | null;
          const batchIds = msgMeta?.batch_video_ids as string[] | undefined;
          if (batchIds && batchIds.length > 0) {
            const { data: batchVids } = await supabase
              .from('videos')
              .select('*')
              .in('id', batchIds)
              .order('created_at', { ascending: true });
            return { ...msg, batchVideos: batchVids || [] };
          }
          if (msg.video_id) {
            const { data: video } = await supabase
              .from('videos')
              .select('*')
              .eq('id', msg.video_id)
              .maybeSingle();
            return { ...msg, video: video || undefined };
          }
          return msg;
        })
      );
      setActiveConv({ ...conv, messages: messagesWithVideos });
    }
  };

  const createNewConversation = async () => {
    if (!user || !selectedModel) return;
    const { data } = await supabase
      .from('conversations')
      .insert({ user_id: user.id, title: 'New Conversation', model: selectedModel.id, sort_order: 0 })
      .select()
      .maybeSingle();

    if (data) {
      // Prepend and renumber so sort_order stays 0-based
      const updated = [data, ...conversations].map((c, i) => ({ ...c, sort_order: i }));
      setConversations(updated);
      await Promise.all(
        updated.map((c, i) => supabase.from('conversations').update({ sort_order: i }).eq('id', c.id))
      );
      setActiveConv({ ...data, messages: [] });
    }
  };

  const [renamingConvId, setRenamingConvId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);

  const reorderConversations = async (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const list = [...conversations];
    const fromIdx = list.findIndex((c) => c.id === fromId);
    const toIdx = list.findIndex((c) => c.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [item] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, item);
    const reordered = list.map((c, i) => ({ ...c, sort_order: i }));
    setConversations(reordered);
    await Promise.all(
      reordered.map((c, i) => supabase.from('conversations').update({ sort_order: i }).eq('id', c.id))
    );
  };

  const startRename = (convId: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingConvId(convId);
    setRenameValue(currentTitle);
  };

  const commitRename = async () => {
    if (!renamingConvId) return;
    const trimmed = renameValue.trim();
    if (trimmed) {
      await supabase.from('conversations').update({ title: trimmed }).eq('id', renamingConvId);
      setConversations((prev) => prev.map((c) => c.id === renamingConvId ? { ...c, title: trimmed } : c));
      if (activeConv?.id === renamingConvId) setActiveConv((prev) => prev ? { ...prev, title: trimmed } : prev);
    }
    setRenamingConvId(null);
  };

  const deleteConversation = (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDialog({
      message: '确认删除此对话？相关消息记录将一并删除。',
      onConfirm: async () => {
        await supabase.from('conversations').delete().eq('id', convId);
        setConversations(conversations.filter((c) => c.id !== convId));
        if (activeConv?.id === convId) setActiveConv(null);
      },
    });
  };

  const LS_KEY = (providerId: string) => `frameforge_apikey_${providerId}`;

  const captureVideoFirstFrame = (videoUrl: string): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.preload = 'metadata';
      const cleanup = () => {
        video.src = '';
        video.load();
      };
      const fail = () => { cleanup(); resolve(null); };
      video.addEventListener('error', fail);
      video.addEventListener('loadeddata', () => {
        video.currentTime = 0;
      });
      video.addEventListener('seeked', () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 360;
          const ctx = canvas.getContext('2d');
          if (!ctx) return fail();
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => { cleanup(); resolve(blob); }, 'image/jpeg', 0.85);
        } catch {
          fail();
        }
      });
      video.src = videoUrl;
      video.load();
    });
  };

  const uploadFrameAsThumb = async (blob: Blob, videoId: string): Promise<string | null> => {
    if (!user) return null;
    const path = `${user.id}/thumb_${videoId}.jpg`;
    const { error } = await supabase.storage.from('i2v-images').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
    if (error) return null;
    const { data: { publicUrl } } = supabase.storage.from('i2v-images').getPublicUrl(path);
    return publicUrl;
  };

  const handleImageUpload = async (files: File[], append = false) => {
    if (!user || files.length === 0) return;
    setImageUploading(true);
    setImageUploadError('');
    try {
      const uploaded: string[] = [];
      for (const file of files) {
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from('i2v-images').upload(path, file, { upsert: true });
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('i2v-images').getPublicUrl(path);
        uploaded.push(publicUrl);
      }
      if (uploaded.length >= 1) {
        setUploadedImageUrl(uploaded[0]);
        if (append) {
          setUploadedImageUrls((prev) => [...prev, ...uploaded]);
        } else {
          setUploadedImageUrls(uploaded);
        }
      }
    } catch (e) {
      setImageUploadError(`上传失败：${String(e)}`);
    } finally {
      setImageUploading(false);
    }
  };

  const uploadI2vImageForTask = async (file: File, taskIndex: number) => {
    if (!user) return;
    setMultiI2vUploading(taskIndex);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('i2v-images').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('i2v-images').getPublicUrl(path);
      setMultiI2vImages((prev) => {
        const next = [...prev];
        next[taskIndex] = publicUrl;
        return next;
      });
    } catch {
      // silently fail — user can retry
    } finally {
      setMultiI2vUploading(null);
    }
  };

  const uploadR2vImagesForTask = async (files: FileList, taskIndex: number) => {
    if (!user || files.length === 0) return;
    setMultiR2vUploading(taskIndex);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from('i2v-images').upload(path, file, { upsert: true });
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('i2v-images').getPublicUrl(path);
        urls.push(publicUrl);
      }
      setMultiR2vImages((prev) => {
        const next = [...prev];
        next[taskIndex] = [...(next[taskIndex] || []), ...urls];
        return next;
      });
    } catch {
      // silently fail — user can retry
    } finally {
      setMultiR2vUploading(null);
    }
  };

  const handleVideoEditUpload = async (file: File) => {
    if (!user) return;
    setVideoEditUploading(true);
    setVideoEditUploadError('');
    try {
      const ext = file.name.split('.').pop() || 'mp4';
      const path = `${user.id}/vedit_${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('i2v-images').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('i2v-images').getPublicUrl(path);
      setUploadedVideoEditUrl(publicUrl);
    } catch (e) {
      setVideoEditUploadError(`上传失败：${String(e)}`);
    } finally {
      setVideoEditUploading(false);
    }
  };

  interface GenOpts { resolution?: string; ratio?: string; duration?: number; watermark?: boolean; imgSize?: string; imgN?: number; imageUrls?: string[]; editVideoUrl?: string; }

  const callAliyunGenerate = async (model: ModelOption, prompt: string, imgUrl?: string, opts?: GenOpts): Promise<{ taskId: string | null; rawResponse: unknown }> => {
    const apiKey = localStorage.getItem(LS_KEY(model.providerId));
    if (!apiKey) return { taskId: null, rawResponse: { error: 'No API key in localStorage' } };

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/aliyun-video/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token || anonKey}`,
          'Content-Type': 'application/json',
          'X-Dashscope-Key': apiKey,
          'X-Dashscope-Region': model.dashscopeRegion || 'intl',
        },
        body: JSON.stringify({
          model: model.id,
          prompt,
          imageUrl: imgUrl || undefined,
          imageUrls: opts?.imageUrls,
          editVideoUrl: opts?.editVideoUrl,
          resolution: opts?.resolution ?? resolution,
          ratio: opts?.ratio ?? ratio,
          duration: opts?.duration ?? duration,
          watermark: opts?.watermark ?? watermark,
        }),
      });

      const data = await res.json();
      console.log('[generate] DashScope response:', JSON.stringify(data));
      return { taskId: data?.output?.task_id || null, rawResponse: data };
    } catch (e) {
      console.error('[generate] fetch error:', e);
      return { taskId: null, rawResponse: { error: String(e) } };
    }
  };

  const pollAliyunTask = async (taskId: string, model: ModelOption): Promise<string | null> => {
    const apiKey = localStorage.getItem(LS_KEY(model.providerId));
    if (!apiKey) return null;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    for (let i = 0; i < 80; i++) {
      await new Promise((r) => setTimeout(r, 15000));
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${supabaseUrl}/functions/v1/aliyun-video/task/${taskId}`, {
          headers: {
            'Authorization': `Bearer ${session?.access_token || anonKey}`,
            'X-Dashscope-Key': apiKey,
            'X-Dashscope-Region': model.dashscopeRegion || 'intl',
          },
        });
        const data = await res.json();
        const status = data?.output?.task_status;
        if (status === 'SUCCEEDED') {
          const raw = data.output.video_url;
          return (Array.isArray(raw) ? raw[0] : raw) || null;
        }
        if (status === 'FAILED' || status === 'CANCELED') return null;
      } catch (e) {
        console.warn('[pollAliyunTask] poll error, retrying:', e);
      }
    }
    return null;
  };

  const callAliyunImageGenerate = async (model: ModelOption, prompt: string, imgUrl?: string, size?: string, n?: number, opts?: GenOpts): Promise<{ taskId: string | null; rawResponse: unknown }> => {
    const apiKey = localStorage.getItem(LS_KEY(model.providerId));
    if (!apiKey) return { taskId: null, rawResponse: { error: 'No API key in localStorage' } };

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/aliyun-video/image-generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token || anonKey}`,
          'Content-Type': 'application/json',
          'X-Dashscope-Key': apiKey,
          'X-Dashscope-Region': model.dashscopeRegion || 'intl',
        },
        body: JSON.stringify({ model: model.id, prompt, imageUrl: imgUrl, size: size || '2K', n: n || 1, watermark: opts?.watermark ?? watermark }),
      });
      const data = await res.json();
      return { taskId: data?.output?.task_id || null, rawResponse: data };
    } catch (e) {
      return { taskId: null, rawResponse: { error: String(e) } };
    }
  };

  const pollAliyunImageTask = async (taskId: string, model: ModelOption): Promise<string | null> => {
    const apiKey = localStorage.getItem(LS_KEY(model.providerId));
    if (!apiKey) return null;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${supabaseUrl}/functions/v1/aliyun-video/task/${taskId}`, {
          headers: {
            'Authorization': `Bearer ${session?.access_token || anonKey}`,
            'X-Dashscope-Key': apiKey,
            'X-Dashscope-Region': model.dashscopeRegion || 'intl',
          },
        });
        const data = await res.json();
        const status = data?.output?.task_status;
        if (status === 'SUCCEEDED') {
          // Image models return output.choices[n].message.content[n].image
          const choices = data?.output?.choices;
          if (Array.isArray(choices) && choices.length > 0) {
            const content = choices[0]?.message?.content;
            if (Array.isArray(content)) {
              const imgItem = content.find((c: Record<string, string>) => c.type === 'image');
              return imgItem?.image || null;
            }
          }
          return null;
        }
        if (status === 'FAILED' || status === 'CANCELED') return null;
      } catch (e) {
        console.warn('[pollAliyunImageTask] poll error, retrying:', e);
      }
    }
    return null;
  };

  const resolveThumb = async (videoUrl: string, videoId: string, imgUrl?: string): Promise<string> => {
    if (imgUrl) return imgUrl;
    const blob = await captureVideoFirstFrame(videoUrl);
    if (blob) {
      const uploaded = await uploadFrameAsThumb(blob, videoId);
      if (uploaded) return uploaded;
    }
    return THUMBNAIL_IMAGES[Math.floor(Math.random() * THUMBNAIL_IMAGES.length)];
  };

  const runVideoGeneration = async (videoId: string, model: ModelOption, prompt: string, imgUrl?: string, opts?: GenOpts): Promise<{ videoUrl: string | null }> => {
    try {
    if (model.providerId === 'aliyun') {
      await supabase.from('videos').update({ status: 'processing', started_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', videoId);

      if (model.modelType === 'img') {
        const { taskId, rawResponse } = await callAliyunImageGenerate(model, prompt, imgUrl, opts?.imgSize ?? imgSize, opts?.imgN ?? imgN, opts);
        if (!taskId) {
          await supabase.from('videos').update({
            status: 'failed',
            metadata: { error: rawResponse },
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('id', videoId);
          return { videoUrl: null };
        }
        await supabase.from('videos').update({
          metadata: { task_id: taskId, provider: model.providerId, model: model.id, dashscope_region: model.dashscopeRegion || 'intl', asset_type: 'image' },
          updated_at: new Date().toISOString(),
        }).eq('id', videoId);

        const imageUrl2 = await pollAliyunImageTask(taskId, model);
        if (imageUrl2) {
          await supabase.from('videos').update({
            status: 'completed',
            thumbnail_url: imageUrl2,
            video_url: imageUrl2,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('id', videoId);
          return { videoUrl: imageUrl2 };
        } else {
          await supabase.rpc('merge_video_metadata', { vid: videoId, patch: { error: { message: '图片生成超时或任务失败' } } });
          await supabase.from('videos').update({ status: 'failed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', videoId);
          return { videoUrl: null };
        }
      }

      const { taskId, rawResponse } = await callAliyunGenerate(model, prompt, imgUrl, opts);
      if (!taskId) {
        await supabase.from('videos').update({
          status: 'failed',
          metadata: { error: rawResponse },
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', videoId);
        return { videoUrl: null };
      }

      await supabase.from('videos').update({
        metadata: {
          task_id: taskId,
          provider: model.providerId,
          model: model.id,
          dashscope_region: model.dashscopeRegion || 'intl',
          ...(opts?.imageUrls && opts.imageUrls.length > 1 ? { image_urls: opts.imageUrls } : {}),
        },
        updated_at: new Date().toISOString(),
      }).eq('id', videoId);

      const videoUrl = await pollAliyunTask(taskId, model);
      if (videoUrl) {
        const thumbnailUrl = await resolveThumb(videoUrl, videoId, imgUrl);
        await supabase.from('videos').update({
          status: 'completed',
          thumbnail_url: thumbnailUrl,
          video_url: videoUrl,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', videoId);
        return { videoUrl };
      } else {
        await supabase.rpc('merge_video_metadata', { vid: videoId, patch: { error: { message: '视频生成超时或任务失败' } } });
        await supabase.from('videos').update({ status: 'failed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', videoId);
        return { videoUrl: null };
      }
    }

    // Fallback simulation for other providers
    const fallbackUrl = 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4';
    await new Promise((r) => setTimeout(r, 2000));
    await supabase.from('videos').update({ status: 'processing', started_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', videoId);
    await new Promise((r) => setTimeout(r, 3000));
    const thumbnailUrl = await resolveThumb(fallbackUrl, videoId, imgUrl);
    await supabase.from('videos').update({
      status: 'completed',
      thumbnail_url: thumbnailUrl,
      video_url: fallbackUrl,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', videoId);
    return { videoUrl: fallbackUrl };
    } catch (e) {
      console.error('[runVideoGeneration] unexpected error:', e);
      try {
        await supabase.from('videos').update({
          status: 'failed',
          metadata: { error: { message: String(e) } },
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', videoId);
      } catch { /* ignore secondary failure */ }
      return { videoUrl: null };
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !user || generating || !selectedModel) return;

    const prompt = inputText.trim();
    setInputText('');

    let conv = activeConv;
    if (!conv) {
      const { data } = await supabase
        .from('conversations')
        .insert({ user_id: user.id, title: prompt.slice(0, 60), model: selectedModel.id })
        .select()
        .maybeSingle();
      if (!data) { return; }
      conv = { ...data, messages: [] };
      setConversations((prev) => [data, ...prev]);
      setActiveConv(conv);
    } else if (conv.messages.length === 0 || conv.title === 'New Conversation') {
      const newTitle = prompt.slice(0, 60);
      await supabase.from('conversations').update({ title: newTitle }).eq('id', conv.id);
      conv = { ...conv, title: newTitle };
      setActiveConv((prev) => prev ? { ...prev, title: newTitle } : prev);
      setConversations((prev) => prev.map((c) => c.id === conv!.id ? { ...c, title: newTitle } : c));
    }

    setGenerating(conv.id, true);

    try {
    const { data: userMsg } = await supabase
      .from('messages')
      .insert({ conversation_id: conv.id, user_id: user.id, role: 'user', content: prompt })
      .select()
      .maybeSingle();

    if (userMsg) {
      setActiveConv((prev) => prev ? { ...prev, messages: [...prev.messages, userMsg] } : prev);
    }

    const isImgModel = selectedModel.modelType === 'img';
    const isI2v = selectedModel.modelType === 'i2v';
    const isR2v = selectedModel.modelType === 'r2v';
    const isV2v = selectedModel.modelType === 'v2v';
    const inputImgUrl = (isI2v || isImgModel)
      ? (imageMode === 'upload' ? uploadedImageUrl || undefined : imageUrl || undefined)
      : undefined;
    const inputImageUrls = isR2v
      ? (imageMode === 'upload' ? (uploadedImageUrls.length > 0 ? uploadedImageUrls : undefined) : (imageUrl ? [imageUrl] : undefined))
      : isV2v
        ? (imageMode === 'upload' ? (uploadedImageUrls.length > 0 ? uploadedImageUrls : undefined) : (imageUrl ? [imageUrl] : undefined))
        : undefined;
    const inputEditVideoUrl = isV2v
      ? (videoEditMode === 'upload' ? uploadedVideoEditUrl || undefined : videoEditUrl || undefined)
      : undefined;
    const initialThumb = inputImgUrl || '';

    const isBatch = batchCount > 1;

    // Create N video records
    const videoInserts = Array.from({ length: batchCount }, (_, i) => ({
      user_id: user.id,
      project_id: selectedProjectId || null,
      title: isBatch ? `${prompt.slice(0, 50)} [${i + 1}/${batchCount}]` : prompt.slice(0, 60),
      prompt,
      model: selectedModel.id,
      duration: isImgModel ? 0 : duration,
      resolution: isImgModel ? imgSize : resolution,
      thumbnail_url: initialThumb,
      status: 'pending' as const,
      metadata: {
        provider: selectedModel.providerId,
        model: selectedModel.id,
        dashscope_region: selectedModel.dashscopeRegion || 'intl',
        asset_type: isImgModel ? 'image' : 'video',
        duration: isImgModel ? 0 : duration,
        resolution: isImgModel ? imgSize : resolution,
        ratio,
        watermark,
        img_size: imgSize,
        img_n: imgN,
        image_url: inputImgUrl || null,
        image_urls: inputImageUrls || null,
        edit_video_url: inputEditVideoUrl || null,
        batch_index: isBatch ? i + 1 : undefined,
        batch_total: isBatch ? batchCount : undefined,
      },
    }));

    const { data: createdVideos } = await supabase
      .from('videos')
      .insert(videoInserts)
      .select();

    const videos = createdVideos || [];

    const assistantContent = isBatch
      ? (isImgModel
        ? `正在使用 **${selectedModel.providerName} · ${selectedModel.name}** 批量生成 **${batchCount}** 张图像...\n\n提示词："${prompt}"\n分辨率：${imgSize}${watermark ? ' | 含水印' : ''}`
        : `正在使用 **${selectedModel.providerName} · ${selectedModel.name}** 批量生成 **${batchCount}** 个视频...\n\n提示词："${prompt}"\n分辨率：${resolution}${isV2v ? '' : ` | 时长：${duration}s | 比例：${ratio}`}${watermark && !isV2v ? ' | 含水印' : ''}`)
      : (isImgModel
        ? `正在使用 **${selectedModel.providerName} · ${selectedModel.name}** 生成图像...\n\n提示词："${prompt}"\n分辨率：${imgSize} | 数量：${imgN}${watermark ? ' | 含水印' : ''}`
        : `正在使用 **${selectedModel.providerName} · ${selectedModel.name}** 生成视频...\n\n提示词："${prompt}"\n分辨率：${resolution}${isV2v ? '' : ` | 时长：${duration}s | 比例：${ratio}`}${watermark && !isV2v ? ' | 含水印' : ''}${isR2v && inputImageUrls ? ` | ${inputImageUrls.length} 张参考图` : ''}${isV2v && inputImageUrls && inputImageUrls.length > 0 ? ` | ${inputImageUrls.length} 张参考图` : ''}`);

    const { data: assistantMsg } = await supabase
      .from('messages')
      .insert({
        conversation_id: conv.id,
        user_id: user.id,
        role: 'assistant',
        content: assistantContent,
        video_id: isBatch ? null : (videos[0]?.id || null),
        metadata: isBatch ? { batch_video_ids: videos.map((v) => v.id), batch_count: batchCount } : {},
      })
      .select()
      .maybeSingle();

    if (assistantMsg) {
      setActiveConv((prev) =>
        prev ? {
          ...prev,
          messages: [...prev.messages, isBatch
            ? { ...assistantMsg, batchVideos: videos }
            : { ...assistantMsg, video: videos[0] || undefined }],
        } : prev
      );
    }

    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conv.id);

    if (videos.length > 0) {
      // Fire all generation requests concurrently
      const genOpts = { imageUrls: inputImageUrls, editVideoUrl: inputEditVideoUrl };
      const results = await Promise.all(
        videos.map((v) => runVideoGeneration(v.id, selectedModel, prompt, inputImgUrl, genOpts))
      );

      // Fetch updated thumbnail/status for all videos
      const updatedVideos = await Promise.all(
        videos.map(async (v, i) => {
          const { data: latest } = await supabase.from('videos').select('thumbnail_url, started_at, completed_at').eq('id', v.id).maybeSingle();
          return {
            ...v,
            status: (results[i].videoUrl ? 'completed' : 'failed') as VideoType['status'],
            thumbnail_url: latest?.thumbnail_url || v.thumbnail_url || '',
            video_url: results[i].videoUrl || '',
            started_at: latest?.started_at ?? null,
            completed_at: latest?.completed_at ?? null,
          } as VideoType;
        })
      );

      setActiveConv((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: prev.messages.map((m) => {
            if (m.id !== assistantMsg?.id) return m;
            if (isBatch) return { ...m, batchVideos: updatedVideos };
            return { ...m, video: updatedVideos[0] };
          }),
        };
      });
    }

    } finally {
      setGenerating(conv.id, false);
    }
  };

  const handleRegenerate = async (params: RegenParams) => {
    if (!user || generating || !activeConv) return;

    const model = availableModels.find((m) => m.id === params.modelId)
      || availableModels.find((m) => m.providerId === params.providerId);
    if (!model) return;

    setGenerating(activeConv.id, true);

    const conv = activeConv;
    try {
    const { data: userMsg } = await supabase
      .from('messages')
      .insert({ conversation_id: conv.id, user_id: user.id, role: 'user', content: `🔄 再生成："${params.prompt}"` })
      .select()
      .maybeSingle();
    if (userMsg) {
      setActiveConv((prev) => prev ? { ...prev, messages: [...prev.messages, userMsg] } : prev);
    }

    const isImgModel = params.assetType === 'image';
    const { data: video } = await supabase
      .from('videos')
      .insert({
        user_id: user.id,
        title: params.prompt.slice(0, 60),
        prompt: params.prompt,
        model: model.id,
        duration: isImgModel ? 0 : params.duration,
        resolution: isImgModel ? params.imgSize : params.resolution,
        thumbnail_url: params.imageUrl || '',
        status: 'pending',
        metadata: {
          provider: model.providerId,
          model: model.id,
          dashscope_region: model.dashscopeRegion || 'intl',
          asset_type: params.assetType,
          duration: params.duration,
          resolution: params.resolution,
          ratio: params.ratio,
          watermark: params.watermark,
          img_size: params.imgSize,
          img_n: params.imgN,
          image_url: params.imageUrl,
        },
      })
      .select()
      .maybeSingle();

    const assistantContent = isImgModel
      ? `正在使用 **${model.providerName} · ${model.name}** 重新生成图像...\n\n提示词："${params.prompt}"\n分辨率：${params.imgSize} | 数量：${params.imgN}`
      : `正在使用 **${model.providerName} · ${model.name}** 重新生成视频...\n\n提示词："${params.prompt}"\n时长：${params.duration}s | 分辨率：${params.resolution} | 比例：${params.ratio}`;

    const { data: assistantMsg } = await supabase
      .from('messages')
      .insert({
        conversation_id: conv.id,
        user_id: user.id,
        role: 'assistant',
        content: assistantContent,
        video_id: video?.id || null,
      })
      .select()
      .maybeSingle();

    if (assistantMsg) {
      setActiveConv((prev) =>
        prev ? { ...prev, messages: [...prev.messages, { ...assistantMsg, video: video || undefined }] } : prev
      );
    }

    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conv.id);

    if (video) {
      const { videoUrl } = await runVideoGeneration(video.id, model, params.prompt, params.imageUrl || undefined, {
        resolution: params.resolution,
        ratio: params.ratio,
        duration: params.duration,
        watermark: params.watermark,
        imgSize: params.imgSize,
        imgN: params.imgN,
      });
      const { data: latestVideo } = await supabase.from('videos').select('thumbnail_url, started_at, completed_at').eq('id', video.id).maybeSingle();
      const updatedVideo: VideoType = {
        ...video,
        status: videoUrl ? 'completed' : 'failed',
        thumbnail_url: latestVideo?.thumbnail_url || video.thumbnail_url || '',
        video_url: videoUrl || '',
        started_at: latestVideo?.started_at ?? null,
        completed_at: latestVideo?.completed_at ?? null,
      };
      setActiveConv((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: prev.messages.map((m) =>
            m.id === assistantMsg?.id ? { ...m, video: updatedVideo } : m
          ),
        };
      });
    }

    } finally {
      setGenerating(conv.id, false);
    }
  };

  const handleMultiPromptSend = async () => {
    const validPrompts = multiPrompts.map((p) => p.trim()).filter(Boolean);
    if (validPrompts.length === 0 || !user || multiPromptRunning || !selectedModel) return;

    // Ensure conversation exists first so we have its ID for per-conv tracking
    let conv = activeConv;
    if (!conv) {
      const title = validPrompts[0].slice(0, 60);
      const { data } = await supabase
        .from('conversations')
        .insert({ user_id: user.id, title, model: selectedModel.id })
        .select()
        .maybeSingle();
      if (!data) return;
      conv = { ...data, messages: [] };
      setConversations((prev) => [data, ...prev]);
      setActiveConv(conv);
    }

    setMultiPromptRunning(conv.id, true);
    setMultiPromptProgress(validPrompts.map((_, i) => ({ index: i, status: 'pending' })));

    const isImgModel = selectedModel.modelType === 'img';
    const isI2v = selectedModel.modelType === 'i2v';
    const isR2v = selectedModel.modelType === 'r2v';
    const isV2v = selectedModel.modelType === 'v2v';
    // For i2v, per-task image is resolved inside the loop; this is the fallback
    const globalInputImgUrl = (isI2v || isImgModel)
      ? (imageMode === 'upload' ? uploadedImageUrl || undefined : imageUrl || undefined)
      : undefined;
    const inputImageUrls = isR2v
      ? (imageMode === 'upload' ? (uploadedImageUrls.length > 0 ? uploadedImageUrls : undefined) : (imageUrl ? [imageUrl] : undefined))
      : isV2v
        ? (imageMode === 'upload' ? (uploadedImageUrls.length > 0 ? uploadedImageUrls : undefined) : (imageUrl ? [imageUrl] : undefined))
        : undefined;
    const inputEditVideoUrl = isV2v
      ? (videoEditMode === 'upload' ? uploadedVideoEditUrl || undefined : videoEditUrl || undefined)
      : undefined;

    // Close the panel and switch back to normal mode
    setMultiPromptMode(false);

    // Process prompts sequentially
    try {
    for (let i = 0; i < validPrompts.length; i++) {
      const prompt = validPrompts[i];
      const isBatch = batchCount > 1;
      // For i2v: use per-task uploaded image if available, else fall back to global
      const inputImgUrl = isI2v
        ? (multiI2vImages[i] || globalInputImgUrl)
        : globalInputImgUrl;
      // For r2v: use per-task images if uploaded, else fall back to global
      const taskR2vImgs = multiR2vImages[i];
      const resolvedImageUrls = isR2v && taskR2vImgs && taskR2vImgs.length > 0
        ? taskR2vImgs
        : inputImageUrls;

      setMultiPromptProgress((prev) =>
        prev.map((p) => p.index === i ? { ...p, status: 'running' } : p)
      );

      // Insert user message
      const { data: userMsg } = await supabase
        .from('messages')
        .insert({
          conversation_id: conv.id,
          user_id: user.id,
          role: 'user',
          content: prompt,
          metadata: { multi_prompt_index: i + 1, multi_prompt_total: validPrompts.length },
        })
        .select()
        .maybeSingle();

      if (userMsg) {
        setActiveConv((prev) => prev ? { ...prev, messages: [...prev.messages, userMsg] } : prev);
      }

      // Create N video records (batchCount copies of this prompt)
      const videoInserts = Array.from({ length: batchCount }, (_, bi) => ({
        user_id: user.id,
        project_id: selectedProjectId || null,
        title: isBatch
          ? `${prompt.slice(0, 45)} [${i + 1}/${validPrompts.length}·${bi + 1}/${batchCount}]`
          : prompt.slice(0, 60),
        prompt,
        model: selectedModel.id,
        duration: isImgModel ? 0 : duration,
        resolution: isImgModel ? imgSize : resolution,
        thumbnail_url: inputImgUrl || '',
        status: 'pending' as const,
        metadata: {
          provider: selectedModel.providerId,
          model: selectedModel.id,
          dashscope_region: selectedModel.dashscopeRegion || 'intl',
          asset_type: isImgModel ? 'image' : 'video',
          duration: isImgModel ? 0 : duration,
          resolution: isImgModel ? imgSize : resolution,
          ratio,
          watermark,
          img_size: imgSize,
          img_n: imgN,
          image_url: inputImgUrl || null,
          image_urls: resolvedImageUrls || null,
          edit_video_url: inputEditVideoUrl || null,
          multi_prompt_index: i + 1,
          multi_prompt_total: validPrompts.length,
          batch_index: isBatch ? bi + 1 : undefined,
          batch_total: isBatch ? batchCount : undefined,
        },
      }));

      const { data: createdVideos } = await supabase.from('videos').insert(videoInserts).select();
      const videos = createdVideos || [];

      const assistantContent = isBatch
        ? (isImgModel
          ? `[${i + 1}/${validPrompts.length}] 正在使用 **${selectedModel.providerName} · ${selectedModel.name}** 批量生成 **${batchCount}** 张图像...\n\n提示词："${prompt}"\n分辨率：${imgSize}${watermark ? ' | 含水印' : ''}`
          : `[${i + 1}/${validPrompts.length}] 正在使用 **${selectedModel.providerName} · ${selectedModel.name}** 批量生成 **${batchCount}** 个视频...\n\n提示词："${prompt}"\n分辨率：${resolution}${isV2v ? '' : ` | 时长：${duration}s | 比例：${ratio}`}${watermark && !isV2v ? ' | 含水印' : ''}`)
        : (isImgModel
          ? `[${i + 1}/${validPrompts.length}] 正在使用 **${selectedModel.providerName} · ${selectedModel.name}** 生成图像...\n\n提示词："${prompt}"\n分辨率：${imgSize}${watermark ? ' | 含水印' : ''}`
          : `[${i + 1}/${validPrompts.length}] 正在使用 **${selectedModel.providerName} · ${selectedModel.name}** 生成视频...\n\n提示词："${prompt}"\n分辨率：${resolution}${isV2v ? '' : ` | 时长：${duration}s | 比例：${ratio}`}${watermark && !isV2v ? ' | 含水印' : ''}`);

      const { data: assistantMsg } = await supabase
        .from('messages')
        .insert({
          conversation_id: conv.id,
          user_id: user.id,
          role: 'assistant',
          content: assistantContent,
          video_id: !isBatch && videos[0] ? videos[0].id : null,
          metadata: {
            multi_prompt_index: i + 1,
            multi_prompt_total: validPrompts.length,
            ...(isBatch ? { batch_video_ids: videos.map((v) => v.id), batch_count: batchCount } : {}),
          },
        })
        .select()
        .maybeSingle();

      if (assistantMsg) {
        setActiveConv((prev) =>
          prev ? {
            ...prev,
            messages: [...prev.messages, isBatch
              ? { ...assistantMsg, batchVideos: videos }
              : { ...assistantMsg, video: videos[0] || undefined }],
          } : prev
        );
      }

      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conv.id);

      if (videos.length > 0) {
        const genOpts = { imageUrls: resolvedImageUrls, editVideoUrl: inputEditVideoUrl };
        let results: { videoUrl: string | null }[];
        try {
          results = await Promise.all(
            videos.map((v) => runVideoGeneration(v.id, selectedModel, prompt, inputImgUrl, genOpts))
          );
        } catch (e) {
          console.error('[multiPrompt] Promise.all error for prompt', i, e);
          results = videos.map(() => ({ videoUrl: null }));
        }

        const updatedVideos = await Promise.all(
          videos.map(async (v, bi) => {
            const { data: latest } = await supabase.from('videos').select('thumbnail_url').eq('id', v.id).maybeSingle();
            return {
              ...v,
              status: (results[bi].videoUrl ? 'completed' : 'failed') as VideoType['status'],
              thumbnail_url: latest?.thumbnail_url || v.thumbnail_url || '',
              video_url: results[bi].videoUrl || '',
            } as VideoType;
          })
        );

        setActiveConv((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            messages: prev.messages.map((m) => {
              if (m.id !== assistantMsg?.id) return m;
              if (isBatch) return { ...m, batchVideos: updatedVideos };
              return { ...m, video: updatedVideos[0] };
            }),
          };
        });

        const allDone = results.every((r) => r.videoUrl);
        const anyDone = results.some((r) => r.videoUrl);
        setMultiPromptProgress((prev) =>
          prev.map((p) => p.index === i ? { ...p, status: allDone ? 'done' : anyDone ? 'done' : 'failed' } : p)
        );
      } else {
        setMultiPromptProgress((prev) =>
          prev.map((p) => p.index === i ? { ...p, status: 'failed' } : p)
        );
      }
    }
    } catch (e) {
      console.error('[multiPromptSend] unexpected error, aborting loop:', e);
    } finally {
      setMultiPromptRunning(conv.id, false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const noKeysConfigured = !keysLoading && availableModels.length === 0;

  return (
    <div className="flex h-full bg-gray-950">
      {/* Conversation Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 overflow-hidden flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col`}>
        <div className="p-3 border-b border-gray-800">
          <button
            onClick={createNewConversation}
            disabled={!selectedModel}
            className="w-full flex items-center gap-2 px-3 py-2.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 rounded-xl text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={16} />
            New Conversation
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              draggable={renamingConvId !== conv.id}
              onDragStart={(e) => {
                dragIdRef.current = conv.id;
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDragOverId(conv.id);
              }}
              onDragLeave={() => setDragOverId(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverId(null);
                if (dragIdRef.current) reorderConversations(dragIdRef.current, conv.id);
                dragIdRef.current = null;
              }}
              onDragEnd={() => { setDragOverId(null); dragIdRef.current = null; }}
              onClick={() => renamingConvId === conv.id ? undefined : loadConversation(conv.id)}
              className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all text-sm select-none
                ${activeConv?.id === conv.id ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/60 hover:text-gray-200'}
                ${dragOverId === conv.id ? 'ring-1 ring-cyan-500/60 bg-gray-800/80' : ''}`}
            >
              <GripVertical size={13} className="flex-shrink-0 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing" />
              {renamingConvId === conv.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
                    if (e.key === 'Escape') { setRenamingConvId(null); }
                    e.stopPropagation();
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 min-w-0 bg-gray-700 border border-cyan-500/50 rounded-lg px-2 py-0.5 text-xs text-white outline-none"
                />
              ) : (
                <span
                  className="flex-1 truncate"
                  onDoubleClick={(e) => startRename(conv.id, conv.title, e)}
                  title="双击重命名"
                >
                  {conv.title}
                </span>
              )}
              {generatingConvIds.has(conv.id) && renamingConvId !== conv.id && (
                <Loader2 size={12} className="flex-shrink-0 animate-spin text-cyan-400" />
              )}
              {renamingConvId !== conv.id && (
                <>
                  <button
                    onClick={(e) => startRename(conv.id, conv.title, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-cyan-400 transition-all rounded"
                    title="重命名"
                  >
                    <Pencil size={11} />
                  </button>
                  <button
                    onClick={(e) => deleteConversation(conv.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all rounded"
                  >
                    <Trash2 size={12} />
                  </button>
                </>
              )}
            </div>
          ))}
          {conversations.length === 0 && (
            <div className="text-center py-8 text-gray-600 text-xs">
              暂无对话<br />开始生成视频吧
            </div>
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="h-14 border-b border-gray-800 flex items-center px-4 gap-3 bg-gray-900/50">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <Film size={16} />
          </button>

          {/* Model selector */}
          <div className="relative">
            {keysLoading ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-gray-400">
                <Loader2 size={13} className="animate-spin" />
                <span>加载模型...</span>
              </div>
            ) : noKeysConfigured ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
                <Key size={13} />
                <span>未配置 API Key</span>
              </div>
            ) : (
              <button
                onClick={() => setShowModelPicker(!showModelPicker)}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl text-sm text-white transition-colors"
              >
                <Sparkles size={14} className="text-cyan-400" />
                <span>{selectedModel?.name}</span>
                <span className="text-xs text-gray-400">{selectedModel?.providerName}</span>
                <ChevronDown size={14} className="text-gray-400" />
              </button>
            )}

            {showModelPicker && availableModels.length > 0 && (
              <div className="absolute top-full left-0 mt-2 w-80 bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
                <div className="p-1.5 space-y-0.5 max-h-80 overflow-y-auto">
                  {availableModels.map((model) => (
                    <button
                      key={`${model.providerId}-${model.id}`}
                      onClick={() => { setSelectedModel(model); setShowModelPicker(false); localStorage.setItem('frameforge_last_model', model.id); }}
                      className={`w-full flex items-start gap-3 px-3 py-3 rounded-xl text-left transition-all
                        ${selectedModel?.id === model.id && selectedModel?.providerId === model.providerId
                          ? 'bg-cyan-500/15 border border-cyan-500/20'
                          : 'hover:bg-gray-700/60'}`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                        {model.modelType === 'img' ? <ImageIcon size={14} className="text-cyan-400" /> : <Video size={14} className="text-cyan-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-white">{model.name}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-700 text-gray-400">{model.providerName}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${model.modelType === 'i2v' ? 'bg-blue-500/20 text-blue-400' : model.modelType === 'r2v' ? 'bg-teal-500/20 text-teal-400' : model.modelType === 'v2v' ? 'bg-rose-500/20 text-rose-400' : model.modelType === 'img' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                            {model.modelType === 'i2v' ? '图生视频' : model.modelType === 'r2v' ? '参考图生视频' : model.modelType === 'v2v' ? '视频编辑' : model.modelType === 'img' ? '图像生成' : '文生视频'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">{model.description}</div>
                        <div className="text-xs text-gray-600 mt-0.5">Key: {model.keyHint}</div>
                      </div>
                      {selectedModel?.id === model.id && selectedModel?.providerId === model.providerId && (
                        <Check size={14} className="text-cyan-400 flex-shrink-0 mt-1" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex-1" />
        </div>

        {/* Settings panel - always visible */}
        <div className="border-b border-gray-800 bg-gray-900/50 px-4 py-3">
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              {selectedModel?.modelType === 'img' ? (
                <>
                  {/* Image size */}
                  <div>
                    <div className="text-xs text-gray-400 mb-2 font-medium">分辨率</div>
                    <div className="flex gap-1.5">
                      {(() => {
                        const hasImageInput = !!(imageUrl.trim() || uploadedImageUrl || uploadedImageUrls.length > 0);
                        const show4K = selectedModel.id === 'wan2.7-image-pro' && !hasImageInput;
                        const sizes = (['1K', '2K', ...(selectedModel.id === 'wan2.7-image-pro' ? ['4K'] : [])] as ('1K' | '2K' | '4K')[]);
                        return sizes.map((s) => {
                          const disabled = s === '4K' && !show4K;
                          return (
                            <button
                              key={s}
                              onClick={() => { if (!disabled) { setImgSize(s); } else { setImgSize('2K'); } }}
                              disabled={disabled}
                              title={disabled ? '图像编辑和组图生成最高支持 2K' : undefined}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all
                                ${disabled ? 'bg-gray-800/40 text-gray-600 border border-gray-800 cursor-not-allowed' : imgSize === s ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'}`}
                            >
                              {s}
                            </button>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {/* Number of images */}
                  <div>
                    <div className="text-xs text-gray-400 mb-2 font-medium">生成数量</div>
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4].map((n) => (
                        <button
                          key={n}
                          onClick={() => setImgN(n)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all
                            ${imgN === n ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'}`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Watermark */}
                  <div>
                    <div className="text-xs text-gray-400 mb-2 font-medium">水印</div>
                    <div className="flex gap-1.5">
                      {[{ value: false, label: '不添加' }, { value: true, label: '添加' }].map((opt) => (
                        <button
                          key={String(opt.value)}
                          onClick={() => setWatermark(opt.value)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all
                            ${watermark === opt.value ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Resolution */}
                  <div>
                    <div className="text-xs text-gray-400 mb-2 font-medium">分辨率</div>
                    <div className="flex gap-1.5">
                      {RESOLUTIONS.map((r) => (
                        <button
                          key={r.value}
                          onClick={() => setResolution(r.value)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all
                            ${resolution === r.value ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'}`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Ratio */}
                  <div>
                    <div className="text-xs text-gray-400 mb-2 font-medium">宽高比</div>
                    <div className="flex flex-wrap gap-1.5">
                      {RATIOS.map((r) => (
                        <button
                          key={r.value}
                          onClick={() => setRatio(r.value)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all
                            ${ratio === r.value ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'}`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Duration */}
                  <div>
                    <div className="text-xs text-gray-400 mb-2 font-medium">时长（秒）</div>
                    <div className="flex gap-1.5">
                      {DURATIONS.map((d) => (
                        <button
                          key={d}
                          onClick={() => setDuration(d)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all
                            ${duration === d ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'}`}
                        >
                          {d}s
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Watermark */}
                  <div>
                    <div className="text-xs text-gray-400 mb-2 font-medium">水印</div>
                    <div className="flex gap-1.5">
                      {[{ value: false, label: '不添加' }, { value: true, label: '添加' }].map((opt) => (
                        <button
                          key={String(opt.value)}
                          onClick={() => setWatermark(opt.value)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all
                            ${watermark === opt.value ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Batch count — always shown */}
              <div>
                <div className="text-xs text-gray-400 mb-2 font-medium flex items-center gap-1.5">
                  <Layers size={11} className="text-cyan-400" />
                  批量生成
                </div>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setBatchCount(n)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all
                        ${batchCount === n ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'}`}
                    >
                      {n}
                    </button>
                  ))}
                  {batchCount > 1 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 font-medium ml-1">
                      批量模式
                    </span>
                  )}
                </div>
              </div>

              {/* Project selector — always shown */}
              {projects.length > 0 && (
                <div>
                  <div className="text-xs text-gray-400 mb-2 font-medium">保存到项目</div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setSelectedProjectId(null)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all
                        ${!selectedProjectId ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'}`}
                    >
                      不归类
                    </button>
                    {projects.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedProjectId(p.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all
                          ${selectedProjectId === p.id ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'}`}
                      >
                        <FolderOpen size={11} />
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          {/* No API keys configured */}
          {noKeysConfigured && (
            <div className="max-w-lg mx-auto mt-16">
              <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-5">
                  <Key size={24} className="text-cyan-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">尚未配置 API Key</h3>
                <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                  请先在 API Keys 页面配置至少一个云厂商的 API Key，才能开始生成视频。
                </p>
                <div className="space-y-2 text-left mb-6">
                  {PROVIDERS.slice(0, 4).map((p) => (
                    <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-800 border border-gray-700">
                      <div className="w-2 h-2 rounded-full bg-gray-600 flex-shrink-0" />
                      <div className="flex-1">
                        <span className="text-sm text-white">{p.name}</span>
                        <span className="text-xs text-gray-500 ml-2">{p.models.length} 个模型</span>
                      </div>
                      <a
                        href={p.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                      >
                        获取 Key <ExternalLink size={10} />
                      </a>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500">
                  前往侧边栏 <span className="text-cyan-400">API Keys</span> 进行配置
                </p>
              </div>
            </div>
          )}

          {/* Empty state with examples */}
          {!activeConv && !noKeysConfigured && (
            <div className="max-w-2xl mx-auto text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-6">
                <Wand2 size={28} className="text-cyan-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">今天想创作什么？</h2>
              {selectedModel && (
                <p className="text-sm text-gray-500 mb-6">
                  当前模型：<span className="text-cyan-400">{selectedModel.providerName} · {selectedModel.name}</span>
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {EXAMPLE_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => setInputText(prompt)}
                    className="text-left p-4 rounded-xl bg-gray-800/60 border border-gray-700 hover:border-cyan-500/30 hover:bg-gray-800 transition-all text-sm text-gray-300"
                  >
                    <Sparkles size={12} className="text-cyan-400 mb-2" />
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {activeConv?.messages.map((msg) => {
            const msgMeta = msg.metadata as Record<string, unknown> | null;
            const multiIdx = msgMeta?.multi_prompt_index as number | undefined;
            const multiTotal = msgMeta?.multi_prompt_total as number | undefined;
            return (
            <div key={msg.id} className={`flex gap-3 max-w-4xl mx-auto w-full ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold
                ${msg.role === 'user' ? 'bg-gray-700 text-gray-300' : 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-400'}`}>
                {msg.role === 'user' ? (profile?.display_name?.[0] || 'U').toUpperCase() : <Sparkles size={14} />}
              </div>

              <div className={`flex flex-col gap-2 max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                {multiIdx && multiTotal && (
                  <div className={`flex items-center gap-1.5 ${msg.role === 'user' ? 'self-end' : 'self-start'}`}>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700 text-gray-400 flex items-center gap-1.5">
                      <Layers size={10} className="text-cyan-400" />
                      任务 {multiIdx}/{multiTotal}
                    </span>
                  </div>
                )}
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed
                  ${msg.role === 'user'
                    ? 'bg-cyan-500/15 border border-cyan-500/20 text-white'
                    : 'bg-gray-800 border border-gray-700 text-gray-200'}`}>
                  {msg.content.split('\n').map((line, i) => {
                    const parts = line.split(/\*\*(.*?)\*\*/g);
                    return (
                      <p key={i} className={i > 0 ? 'mt-1' : ''}>
                        {parts.map((part, j) =>
                          j % 2 === 1 ? <strong key={j} className="text-white">{part}</strong> : part
                        )}
                      </p>
                    );
                  })}
                </div>

                {msg.video && (
                  <VideoCard
                    video={msg.video}
                    onQuickEdit={(prompt) => setInputText(prompt)}
                    onRegenerate={handleRegenerate}
                  />
                )}

                {msg.batchVideos && msg.batchVideos.length > 0 && (
                  <BatchVideoGrid
                    videos={msg.batchVideos}
                    onQuickEdit={(prompt) => setInputText(prompt)}
                    onRegenerate={handleRegenerate}
                  />
                )}

                {msg.role === 'assistant' && !msg.video && !msg.batchVideos && generating && (
                  <div className="flex items-center gap-2 text-xs text-gray-400 px-2">
                    <Loader2 size={12} className="animate-spin text-cyan-400" />
                    <span>正在生成视频...</span>
                  </div>
                )}
              </div>
            </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-800 p-4 bg-gray-900/50">
          <div className="max-w-4xl mx-auto">

            {/* Multi-prompt mode panel */}
            {multiPromptMode && (
              <div className="mb-3 bg-gray-800/80 border border-cyan-500/20 rounded-2xl overflow-hidden">
                {/* Panel header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/60 bg-gray-900/40">
                  <div className="flex items-center gap-2">
                    <Layers size={15} className="text-cyan-400" />
                    <span className="text-sm font-semibold text-white">多提示词批量任务</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/20">
                      {multiPrompts.filter((p) => p.trim()).length} / {multiPrompts.length} 个任务
                    </span>
                  </div>
                  <button
                    onClick={() => setMultiPromptMode(false)}
                    className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* i2v per-task image hint */}
                {selectedModel?.modelType === 'i2v' && imageMode === 'upload' && (
                  <div className="mx-3 mt-3 px-3 py-2.5 bg-cyan-500/8 border border-cyan-500/20 rounded-xl flex items-start gap-2">
                    <ImageIcon size={13} className="text-cyan-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-cyan-300/80 leading-relaxed">
                      图生视频模式：每个任务可单独指定首帧图片。未上传图片的任务将使用下方输入框中的全局首帧图片。图片与任务按顺序匹配。
                    </p>
                  </div>
                )}

                {/* r2v per-task image hint */}
                {selectedModel?.modelType === 'r2v' && imageMode === 'upload' && (
                  <div className="mx-3 mt-3 px-3 py-2.5 bg-cyan-500/8 border border-cyan-500/20 rounded-xl flex items-start gap-2">
                    <ImageIcon size={13} className="text-cyan-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-cyan-300/80 leading-relaxed">
                      参考图生视频模式：每个任务可单独上传多张参考图片。未上传的任务将使用下方输入框中的全局参考图片。
                    </p>
                  </div>
                )}

                {/* Prompt list */}
                <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
                  {multiPrompts.map((p, i) => {
                    const taskImg = multiI2vImages[i];
                    const taskR2vImgs = multiR2vImages[i] || [];
                    const showImgSlot = selectedModel?.modelType === 'i2v' && imageMode === 'upload';
                    const showR2vSlot = selectedModel?.modelType === 'r2v' && imageMode === 'upload';
                    return (
                    <div key={i} className="flex items-start gap-2">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center text-xs text-gray-400 font-medium mt-1.5">
                        {i + 1}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1.5">
                        {/* Per-task image slot for i2v */}
                        {showImgSlot && (
                          <div className="flex items-center gap-2">
                            {taskImg ? (
                              <div className="flex items-center gap-2 flex-1 min-w-0 bg-gray-900 border border-gray-700 rounded-xl px-2 py-1.5">
                                <img src={taskImg} alt={`任务${i + 1}首帧`} className="w-10 h-7 object-cover rounded-md border border-gray-600 flex-shrink-0" />
                                <span className="text-xs text-emerald-400 flex items-center gap-1 flex-shrink-0">
                                  <Check size={10} /> 已上传
                                </span>
                                <span className="text-xs text-gray-500 truncate flex-1">{taskImg.split('/').pop()?.slice(-20)}</span>
                                <button
                                  onClick={() => setMultiI2vImages((prev) => { const n = [...prev]; n[i] = ''; return n; })}
                                  className="p-0.5 text-gray-500 hover:text-red-400 transition-colors flex-shrink-0"
                                >
                                  <X size={11} />
                                </button>
                              </div>
                            ) : (
                              <label className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-900 border border-dashed border-gray-600 hover:border-cyan-500/50 rounded-xl text-xs text-gray-500 hover:text-gray-300 transition-all cursor-pointer flex-1">
                                {multiI2vUploading === i
                                  ? <><Loader2 size={11} className="animate-spin text-cyan-400" /> 上传中...</>
                                  : <><Upload size={11} /> 任务 {i + 1} 的首帧图片（不上传则用全局图片）</>
                                }
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp,image/gif"
                                  className="hidden"
                                  disabled={multiI2vUploading !== null}
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) uploadI2vImageForTask(f, i);
                                    e.target.value = '';
                                  }}
                                />
                              </label>
                            )}
                          </div>
                        )}

                        {/* Per-task image slot for r2v (multiple images) */}
                        {showR2vSlot && (
                          <div className="space-y-1.5">
                            {taskR2vImgs.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 p-2 bg-gray-900 border border-gray-700 rounded-xl">
                                {taskR2vImgs.map((url, imgIdx) => (
                                  <div key={imgIdx} className="relative group/thumb">
                                    <img
                                      src={url}
                                      alt={`任务${i + 1}参考图${imgIdx + 1}`}
                                      className="w-12 h-9 object-cover rounded-lg border border-gray-600"
                                    />
                                    <button
                                      onClick={() => setMultiR2vImages((prev) => {
                                        const next = [...prev];
                                        next[i] = (next[i] || []).filter((_, idx) => idx !== imgIdx);
                                        return next;
                                      })}
                                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 hover:bg-red-400 rounded-full flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                                    >
                                      <X size={9} />
                                    </button>
                                  </div>
                                ))}
                                <label className="w-12 h-9 flex items-center justify-center bg-gray-800 border border-dashed border-gray-600 hover:border-cyan-500/50 rounded-lg cursor-pointer transition-colors">
                                  {multiR2vUploading === i
                                    ? <Loader2 size={12} className="animate-spin text-cyan-400" />
                                    : <Plus size={14} className="text-gray-500 hover:text-gray-300" />
                                  }
                                  <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/gif"
                                    multiple
                                    className="hidden"
                                    disabled={multiR2vUploading !== null}
                                    onChange={(e) => {
                                      if (e.target.files?.length) uploadR2vImagesForTask(e.target.files, i);
                                      e.target.value = '';
                                    }}
                                  />
                                </label>
                                <div className="flex items-center ml-1">
                                  <span className="text-xs text-emerald-400 flex items-center gap-1">
                                    <Check size={10} /> {taskR2vImgs.length} 张
                                  </span>
                                </div>
                              </div>
                            )}
                            {taskR2vImgs.length === 0 && (
                              <label className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-900 border border-dashed border-gray-600 hover:border-cyan-500/50 rounded-xl text-xs text-gray-500 hover:text-gray-300 transition-all cursor-pointer">
                                {multiR2vUploading === i
                                  ? <><Loader2 size={11} className="animate-spin text-cyan-400" /> 上传中...</>
                                  : <><Upload size={11} /> 任务 {i + 1} 的参考图片（可多张，不上传则用全局图片）</>
                                }
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp,image/gif"
                                  multiple
                                  className="hidden"
                                  disabled={multiR2vUploading !== null}
                                  onChange={(e) => {
                                    if (e.target.files?.length) uploadR2vImagesForTask(e.target.files, i);
                                    e.target.value = '';
                                  }}
                                />
                              </label>
                            )}
                          </div>
                        )}

                        <textarea
                          value={p}
                          onChange={(e) => {
                            const next = [...multiPrompts];
                            next[i] = e.target.value;
                            setMultiPrompts(next);
                          }}
                          placeholder={`提示词 ${i + 1}...`}
                          rows={2}
                          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-cyan-500/60 transition-colors"
                        />
                      </div>

                      {multiPrompts.length > 1 && (
                        <button
                          onClick={() => {
                            setMultiPrompts(multiPrompts.filter((_, idx) => idx !== i));
                            setMultiI2vImages((prev) => prev.filter((_, idx) => idx !== i));
                            setMultiR2vImages((prev) => prev.filter((_, idx) => idx !== i));
                          }}
                          className="flex-shrink-0 p-1.5 text-gray-600 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-colors mt-1"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                    );
                  })}
                </div>

                {/* Panel footer */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700/60 bg-gray-900/20">
                  <button
                    onClick={() => {
                      if (multiPrompts.length < 20) setMultiPrompts([...multiPrompts, '']);
                    }}
                    disabled={multiPrompts.length >= 20}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 text-xs font-medium rounded-xl transition-colors"
                  >
                    <Plus size={13} />
                    添加任务（{multiPrompts.length}/20）
                  </button>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">按顺序逐个提交</span>
                    <button
                      onClick={handleMultiPromptSend}
                      disabled={
                        multiPromptRunning ||
                        multiPrompts.filter((p) => p.trim()).length === 0 ||
                        !selectedModel ||
                        (selectedModel?.modelType === 'i2v' && imageMode === 'url' && !imageUrl.trim()) ||
                        (selectedModel?.modelType === 'i2v' && imageMode === 'upload' && !uploadedImageUrl && multiI2vImages.every((img) => !img)) ||
                        (selectedModel?.modelType === 'r2v' && (imageMode === 'url' ? !imageUrl.trim() : uploadedImageUrls.length === 0 && multiR2vImages.every((imgs) => !imgs || imgs.length === 0))) ||
                        (selectedModel?.modelType === 'v2v' && (videoEditMode === 'url' ? !videoEditUrl.trim() : !uploadedVideoEditUrl))
                      }
                      className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-all"
                    >
                      {multiPromptRunning ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      {multiPromptRunning
                        ? `生成中 ${multiPromptProgress.filter((p) => p.status === 'done' || p.status === 'failed').length}/${multiPromptProgress.length}...`
                        : `提交 ${multiPrompts.filter((p) => p.trim()).length} 个任务`}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* V2V: video input (required) */}
            {selectedModel?.modelType === 'v2v' && (
              <div className="mb-3 bg-gray-800/60 border border-gray-700/60 rounded-2xl p-3">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
                    <Film size={13} className="text-rose-400" />
                    参考视频（必填，1 个）
                  </span>
                  <div className="flex items-center bg-gray-900 rounded-lg p-0.5">
                    <button onClick={() => setVideoEditMode('url')} className={`px-3 py-1 text-xs rounded-md transition-colors ${videoEditMode === 'url' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>URL</button>
                    <button onClick={() => setVideoEditMode('upload')} className={`px-3 py-1 text-xs rounded-md transition-colors ${videoEditMode === 'upload' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>本地上传</button>
                  </div>
                </div>
                {videoEditMode === 'url' ? (
                  <input
                    type="url"
                    value={videoEditUrl}
                    onChange={(e) => setVideoEditUrl(e.target.value)}
                    placeholder="https://... 视频 URL（mp4）"
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-rose-500 transition-colors"
                  />
                ) : (
                  <div>
                    <input
                      ref={videoEditFileRef}
                      type="file"
                      accept="video/mp4,video/webm,video/*"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleVideoEditUpload(f); }}
                    />
                    {uploadedVideoEditUrl ? (
                      <div className="flex items-center gap-3">
                        <div className="w-20 h-12 rounded-lg border border-gray-600 flex-shrink-0 bg-gray-800 flex items-center justify-center">
                          <Film size={16} className="text-rose-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-emerald-400 flex items-center gap-1 mb-1"><Check size={11} /> 已上传</p>
                          <p className="text-xs text-gray-500 truncate">{uploadedVideoEditUrl.split('/').pop()}</p>
                        </div>
                        <button onClick={() => { setUploadedVideoEditUrl(''); if (videoEditFileRef.current) videoEditFileRef.current.value = ''; }} className="p-1 text-gray-500 hover:text-white transition-colors flex-shrink-0"><X size={14} /></button>
                      </div>
                    ) : (
                      <button onClick={() => videoEditFileRef.current?.click()} disabled={videoEditUploading} className="w-full flex flex-col items-center justify-center gap-2 py-4 border-2 border-dashed border-gray-600 hover:border-rose-500/50 rounded-xl text-gray-500 hover:text-gray-300 transition-all disabled:opacity-50">
                        {videoEditUploading ? <><Loader2 size={18} className="animate-spin" /><span className="text-xs">上传中...</span></> : <><Upload size={18} /><span className="text-xs">点击选择视频（MP4 / WebM）</span></>}
                      </button>
                    )}
                    {videoEditUploadError && <p className="text-xs text-red-400 mt-1.5">{videoEditUploadError}</p>}
                  </div>
                )}
              </div>
            )}

            {/* V2V: optional reference images (0-5) */}
            {selectedModel?.modelType === 'v2v' && (
              <div className="mb-3 bg-gray-800/60 border border-gray-700/60 rounded-2xl p-3">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
                    <ImageIcon size={13} className="text-cyan-400" />
                    参考图片（可选，最多 5 张）
                  </span>
                  <div className="flex items-center bg-gray-900 rounded-lg p-0.5">
                    <button onClick={() => setImageMode('url')} className={`px-3 py-1 text-xs rounded-md transition-colors ${imageMode === 'url' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>URL</button>
                    <button onClick={() => setImageMode('upload')} className={`px-3 py-1 text-xs rounded-md transition-colors ${imageMode === 'upload' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>本地上传</button>
                  </div>
                </div>
                {imageMode === 'url' ? (
                  <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://... 参考图 URL（可选）" className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors" />
                ) : (
                  <div>
                    <input ref={imageFileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={(e) => { const files = Array.from(e.target.files || []); if (files.length > 0) handleImageUpload(files, true); }} />
                    {uploadedImageUrls.length > 0 ? (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-xs text-emerald-400 flex items-center gap-1"><Check size={11} /> 已上传 {uploadedImageUrls.length} 张参考图</p>
                          <button onClick={() => { setUploadedImageUrl(''); setUploadedImageUrls([]); if (imageFileRef.current) imageFileRef.current.value = ''; }} className="text-xs text-gray-500 hover:text-red-400 transition-colors flex items-center gap-1"><X size={11} /> 清除</button>
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                          {uploadedImageUrls.map((url, idx) => (
                            <div key={url} className="relative group">
                              <img src={url} alt={`参考图 ${idx + 1}`} className="w-14 h-14 object-cover rounded-lg border border-gray-600" />
                              <span className="absolute top-0.5 left-0.5 text-[9px] bg-black/60 text-white rounded px-1">{idx + 1}</span>
                              <button onClick={() => { const next = uploadedImageUrls.filter((_, i) => i !== idx); setUploadedImageUrls(next); setUploadedImageUrl(next[0] || ''); }} className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 p-0.5 bg-black/70 rounded text-white transition-opacity"><X size={10} /></button>
                            </div>
                          ))}
                          {uploadedImageUrls.length < 5 && (
                            <button onClick={() => imageFileRef.current?.click()} disabled={imageUploading} className="w-14 h-14 flex flex-col items-center justify-center border-2 border-dashed border-gray-600 hover:border-cyan-500/50 rounded-lg text-gray-500 hover:text-gray-300 transition-all disabled:opacity-50">
                              {imageUploading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => imageFileRef.current?.click()} disabled={imageUploading} className="w-full flex flex-col items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-600 hover:border-cyan-500/50 rounded-xl text-gray-500 hover:text-gray-300 transition-all disabled:opacity-50">
                        {imageUploading ? <><Loader2 size={16} className="animate-spin" /><span className="text-xs">上传中...</span></> : <><Upload size={16} /><span className="text-xs">点击选择参考图（可多选，最多 5 张）</span></>}
                      </button>
                    )}
                    {imageUploadError && <p className="text-xs text-red-400 mt-1.5">{imageUploadError}</p>}
                  </div>
                )}
              </div>
            )}

            {/* Image input for i2v / r2v models (required) and img models (optional) */}
            {(selectedModel?.modelType === 'i2v' || selectedModel?.modelType === 'r2v' || selectedModel?.modelType === 'img') && (
              <div className="mb-3 bg-gray-800/60 border border-gray-700/60 rounded-2xl p-3">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
                    <ImageIcon size={13} className="text-cyan-400" />
                    {selectedModel.modelType === 'i2v' ? '首帧图片（必填）' : selectedModel.modelType === 'r2v' ? '参考图片，可上传多张（必填）' : '参考图片（可选）'}
                  </span>
                  <div className="flex items-center bg-gray-900 rounded-lg p-0.5">
                    <button
                      onClick={() => setImageMode('url')}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${imageMode === 'url' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      URL
                    </button>
                    <button
                      onClick={() => setImageMode('upload')}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${imageMode === 'upload' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      本地上传
                    </button>
                  </div>
                </div>

                {imageMode === 'url' ? (
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://... 图片 URL"
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                ) : selectedModel.modelType === 'r2v' ? (
                  /* R2V: multi-image upload */
                  <div>
                    <input
                      ref={imageFileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        if (files.length > 0) handleImageUpload(files, true);
                      }}
                    />
                    {uploadedImageUrls.length > 0 ? (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-xs text-emerald-400 flex items-center gap-1">
                            <Check size={11} /> 已上传 {uploadedImageUrls.length} 张参考图
                          </p>
                          <button
                            onClick={() => { setUploadedImageUrl(''); setUploadedImageUrls([]); if (imageFileRef.current) imageFileRef.current.value = ''; }}
                            className="text-xs text-gray-500 hover:text-red-400 transition-colors flex items-center gap-1"
                          >
                            <X size={11} /> 清除全部
                          </button>
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                          {uploadedImageUrls.map((url, idx) => (
                            <div key={url} className="relative group">
                              <img src={url} alt={`参考图 ${idx + 1}`} className="w-14 h-14 object-cover rounded-lg border border-gray-600" />
                              <span className="absolute top-0.5 left-0.5 text-[9px] bg-black/60 text-white rounded px-1">{idx + 1}</span>
                              <button
                                onClick={() => {
                                  const next = uploadedImageUrls.filter((_, i) => i !== idx);
                                  setUploadedImageUrls(next);
                                  setUploadedImageUrl(next[0] || '');
                                }}
                                className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 p-0.5 bg-black/70 rounded text-white transition-opacity"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => imageFileRef.current?.click()}
                            disabled={imageUploading}
                            className="w-14 h-14 flex flex-col items-center justify-center border-2 border-dashed border-gray-600 hover:border-cyan-500/50 rounded-lg text-gray-500 hover:text-gray-300 transition-all disabled:opacity-50"
                          >
                            {imageUploading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => imageFileRef.current?.click()}
                        disabled={imageUploading}
                        className="w-full flex flex-col items-center justify-center gap-2 py-4 border-2 border-dashed border-gray-600 hover:border-cyan-500/50 rounded-xl text-gray-500 hover:text-gray-300 transition-all disabled:opacity-50"
                      >
                        {imageUploading ? (
                          <><Loader2 size={18} className="animate-spin" /><span className="text-xs">上传中...</span></>
                        ) : (
                          <><Upload size={18} /><span className="text-xs">点击选择参考图（可多选）</span></>
                        )}
                      </button>
                    )}
                    {imageUploadError && <p className="text-xs text-red-400 mt-1.5">{imageUploadError}</p>}
                  </div>
                ) : (
                  /* I2V / img: single-image upload */
                  <div>
                    <input
                      ref={imageFileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload([file]);
                      }}
                    />
                    {uploadedImageUrl ? (
                      <div className="flex items-center gap-3">
                        <img src={uploadedImageUrl} alt="图片预览" className="w-20 h-12 object-cover rounded-lg border border-gray-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-emerald-400 flex items-center gap-1 mb-1">
                            <Check size={11} /> 已上传
                          </p>
                          <p className="text-xs text-gray-500 truncate">{uploadedImageUrl.split('/').pop()}</p>
                        </div>
                        <button
                          onClick={() => { setUploadedImageUrl(''); setUploadedImageUrls([]); if (imageFileRef.current) imageFileRef.current.value = ''; }}
                          className="p-1 text-gray-500 hover:text-white transition-colors flex-shrink-0"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => imageFileRef.current?.click()}
                        disabled={imageUploading}
                        className="w-full flex flex-col items-center justify-center gap-2 py-4 border-2 border-dashed border-gray-600 hover:border-cyan-500/50 rounded-xl text-gray-500 hover:text-gray-300 transition-all disabled:opacity-50"
                      >
                        {imageUploading ? (
                          <><Loader2 size={18} className="animate-spin" /><span className="text-xs">上传中...</span></>
                        ) : (
                          <><Upload size={18} /><span className="text-xs">点击选择图片（JPG / PNG / WebP）</span></>
                        )}
                      </button>
                    )}
                    {imageUploadError && <p className="text-xs text-red-400 mt-1.5">{imageUploadError}</p>}
                  </div>
                )}
              </div>
            )}
            <div className={`relative bg-gray-800 border rounded-2xl transition-colors ${noKeysConfigured ? 'border-gray-700 opacity-50' : 'border-gray-700 focus-within:border-cyan-500/50'}`}>
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={noKeysConfigured}
                placeholder={noKeysConfigured ? '请先配置 API Key' : '描述您想生成的视频内容...（例如：夕阳下的海浪拍打礁石，航拍镜头）'}
                rows={3}
                className="w-full bg-transparent px-4 pt-4 pb-12 text-white placeholder-gray-500 text-sm resize-none focus:outline-none disabled:cursor-not-allowed"
              />
              <div className="absolute bottom-3 left-4 right-3 flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <button
                    type="button"
                    onClick={() => { setMultiPromptMode(!multiPromptMode); }}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all text-xs font-medium
                      ${multiPromptMode
                        ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400'
                        : 'bg-gray-700/50 border-gray-600 text-gray-500 hover:text-gray-300 hover:border-gray-500'}`}
                    title="多提示词批量任务"
                  >
                    <Layers size={11} />
                    批量任务
                  </button>
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    {duration}s
                  </span>
                  <span className="flex items-center gap-1">
                    <Zap size={11} />
                    {resolution}
                  </span>
                  <span className="text-gray-600">·</span>
                  <span>{ratio}</span>
                  {watermark && <span className="text-gray-600">· 水印</span>}
                </div>
                <button
                  onClick={handleSend}
                  disabled={!inputText.trim() || generating || !selectedModel
                    || (selectedModel?.modelType === 'i2v' && (imageMode === 'url' ? !imageUrl.trim() : !uploadedImageUrl))
                    || (selectedModel?.modelType === 'r2v' && (imageMode === 'url' ? !imageUrl.trim() : uploadedImageUrls.length === 0))
                    || (selectedModel?.modelType === 'v2v' && (videoEditMode === 'url' ? !videoEditUrl.trim() : !uploadedVideoEditUrl))
                  }
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-all"
                >
                  {generating ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {generating ? '生成中...' : batchCount > 1 ? `批量生成 ×${batchCount}` : '生成'}
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-600 text-center mt-2">
              Enter 发送 · Shift+Enter 换行
            </p>
          </div>
        </div>
      </div>

      {/* Confirm dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                <Trash2 size={16} className="text-red-400" />
              </div>
              <p className="text-sm text-gray-200 leading-relaxed">{confirmDialog.message}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-400 text-white font-medium text-sm rounded-xl transition-colors"
              >
                删除
              </button>
              <button
                onClick={() => setConfirmDialog(null)}
                className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-xl transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface RegenParams {
  prompt: string;
  modelId: string;
  providerId: string;
  dashscopeRegion: string;
  assetType: 'image' | 'video';
  duration: number;
  resolution: string;
  ratio: string;
  watermark: boolean;
  imgSize: '1K' | '2K' | '4K';
  imgN: number;
  imageUrl: string | null;
}

function BatchVideoGrid({ videos, onQuickEdit, onRegenerate }: {
  videos: VideoType[];
  onQuickEdit?: (prompt: string) => void;
  onRegenerate?: (params: RegenParams) => void;
}) {
  const completedCount = videos.filter((v) => v.status === 'completed').length;
  const failedCount = videos.filter((v) => v.status === 'failed').length;
  const pendingCount = videos.length - completedCount - failedCount;

  return (
    <div className="w-full max-w-4xl">
      {/* Batch summary bar */}
      <div className="flex items-center gap-3 mb-3 px-1">
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Layers size={12} className="text-cyan-400" />
          <span className="font-medium text-white">{videos.length}</span> 个任务
        </div>
        {completedCount > 0 && (
          <span className="text-xs text-emerald-400 flex items-center gap-1">
            <Check size={11} /> {completedCount} 完成
          </span>
        )}
        {failedCount > 0 && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <AlertCircle size={11} /> {failedCount} 失败
          </span>
        )}
        {pendingCount > 0 && (
          <span className="text-xs text-blue-400 flex items-center gap-1">
            <Loader2 size={11} className="animate-spin" /> {pendingCount} 进行中
          </span>
        )}
      </div>
      {/* Grid: 2 columns for ≤4, 3 columns for more */}
      <div className={`grid gap-3 ${videos.length <= 2 ? 'grid-cols-1 sm:grid-cols-2' : videos.length <= 4 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
        {videos.map((v, i) => (
          <div key={v.id} className="relative">
            <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full bg-black/70 text-white text-xs font-medium">
              {i + 1}/{videos.length}
            </div>
            <VideoCard video={v} onQuickEdit={onQuickEdit} onRegenerate={onRegenerate} />
          </div>
        ))}
      </div>
    </div>
  );
}

function VideoCard({ video, onQuickEdit, onRegenerate }: {
  video: VideoType;
  onQuickEdit?: (prompt: string) => void;
  onRegenerate?: (params: RegenParams) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [showTaskId, setShowTaskId] = useState(false);
  const [taskStatus, setTaskStatus] = useState<Record<string, unknown> | null>(null);
  const [taskStatusLoading, setTaskStatusLoading] = useState(false);
  const [showTaskStatus, setShowTaskStatus] = useState(false);

  const meta = video.metadata as Record<string, unknown> | null;
  const taskId = meta?.task_id as string | undefined;
  const providerId = meta?.provider as string | undefined;
  const region = (meta?.dashscope_region as string | undefined) || 'intl';
  const isImageAsset = meta?.asset_type === 'image';

  const errorInfo = meta?.error as Record<string, unknown> | null | undefined;
  const errorMessage = (() => {
    if (!errorInfo) return null;
    if (typeof errorInfo.message === 'string') return errorInfo.message;
    // Aliyun API error shape: { code, message, request_id }
    if (typeof errorInfo.code === 'string' || typeof errorInfo.message === 'string') {
      const parts: string[] = [];
      if (errorInfo.message) parts.push(String(errorInfo.message));
      if (errorInfo.code) parts.push(`[${errorInfo.code}]`);
      if (errorInfo.request_id) parts.push(`req: ${errorInfo.request_id}`);
      return parts.join(' ') || null;
    }
    return JSON.stringify(errorInfo);
  })();

  const copyTaskId = () => {
    if (!taskId) return;
    navigator.clipboard.writeText(taskId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const queryTaskStatus = async () => {
    if (!taskId || !providerId) return;
    const LS_KEY = `frameforge_apikey_${providerId}`;
    const apiKey = localStorage.getItem(LS_KEY);
    if (!apiKey) return;

    setTaskStatusLoading(true);
    setShowTaskStatus(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/aliyun-video/task/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token || anonKey}`,
          'X-Dashscope-Key': apiKey,
          'X-Dashscope-Region': region,
        },
      });
      const data = await res.json();
      setTaskStatus(data);
    } catch {
      setTaskStatus({ error: '查询失败，请重试' });
    } finally {
      setTaskStatusLoading(false);
    }
  };

  const [recovering, setRecovering] = useState(false);
  const [recoveredUrl, setRecoveredUrl] = useState('');

  const recoverFromTask = async () => {
    if (!taskId || !providerId) return;
    const LS_KEY = `frameforge_apikey_${providerId}`;
    const apiKey = localStorage.getItem(LS_KEY);
    if (!apiKey) return;

    setRecovering(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/aliyun-video/task/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token || anonKey}`,
          'X-Dashscope-Key': apiKey,
          'X-Dashscope-Region': region,
        },
      });
      const data = await res.json();
      const status = data?.output?.task_status;

      if (status === 'SUCCEEDED') {
        let url: string | null = null;
        if (isImageAsset) {
          const choices = data?.output?.choices;
          if (Array.isArray(choices) && choices.length > 0) {
            const content = choices[0]?.message?.content;
            if (Array.isArray(content)) {
              const imgItem = content.find((c: Record<string, string>) => c.type === 'image');
              url = imgItem?.image || null;
            }
          }
        } else {
          const raw = data?.output?.video_url;
          url = (Array.isArray(raw) ? raw[0] : raw) || null;
        }

        if (url) {
          await supabase.from('videos').update({
            status: 'completed',
            thumbnail_url: url,
            video_url: url,
            updated_at: new Date().toISOString(),
          }).eq('id', video.id);
          setRecoveredUrl(url);
        }
      }
    } catch {
      // silent
    } finally {
      setRecovering(false);
    }
  };

  const statusConfig = {
    pending: { color: 'text-yellow-400', bg: 'bg-yellow-400/10', icon: Clock, label: '队列中' },
    processing: { color: 'text-blue-400', bg: 'bg-blue-400/10', icon: Loader2, label: isImageAsset ? '生图中' : '生成中' },
    completed: { color: 'text-emerald-400', bg: 'bg-emerald-400/10', icon: Check, label: '已完成' },
    failed: { color: 'text-red-400', bg: 'bg-red-400/10', icon: AlertCircle, label: '失败' },
  };
  const s = statusConfig[video.status];
  const StatusIcon = s.icon;

  const displayVideoUrl = recoveredUrl || video.video_url || '';
  const displayThumbUrl = recoveredUrl || video.thumbnail_url || '';
  const displayUrl = displayVideoUrl || displayThumbUrl;
  const displayStatus = recoveredUrl ? 'completed' : video.status;
  const ds = statusConfig[displayStatus];
  const DsIcon = ds.icon;

  return (
    <div className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
      <div className={`relative bg-gray-800 ${isImageAsset ? 'aspect-square' : 'aspect-video'}`}>
        {displayStatus === 'completed' && displayUrl ? (
          isImageAsset ? (
            <img src={displayThumbUrl} alt={video.title} className="w-full h-full object-contain" />
          ) : (
            <video
              src={displayVideoUrl}
              controls
              playsInline
              className="w-full h-full object-contain bg-black"
              preload="metadata"
            />
          )
        ) : displayStatus === 'processing' ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-2 border-gray-700 border-t-cyan-400 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                {isImageAsset ? <ImageIcon size={16} className="text-cyan-400" /> : <Film size={16} className="text-cyan-400" />}
              </div>
            </div>
            <p className="text-xs text-gray-400">{isImageAsset ? '生图中，请稍候...' : '视频生成中，请稍候...'}</p>
          </div>
        ) : displayStatus === 'pending' ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3">
            <Clock size={28} className="text-yellow-400/60" />
            <p className="text-xs text-gray-400">队列等待中...</p>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 px-3">
            <AlertCircle size={24} className="text-red-400/70 flex-shrink-0" />
            <p className="text-xs text-gray-400 font-medium">生成失败</p>
            {errorMessage && (
              <p className="text-xs text-red-300/70 text-center leading-relaxed max-h-20 overflow-y-auto break-all">{errorMessage}</p>
            )}
          </div>
        )}
        <div className={`absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-full ${ds.bg} border border-current/20`}>
          <DsIcon size={11} className={`${ds.color} ${displayStatus === 'processing' ? 'animate-spin' : ''}`} />
          <span className={`text-xs font-medium ${ds.color}`}>{ds.label}</span>
        </div>
        {displayStatus === 'completed' && (
          <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-xs">
            {isImageAsset ? video.resolution : `${video.duration}s · ${video.resolution}`}
          </div>
        )}
      </div>

      {/* Task ID row */}
      {taskId && (
        <div className="px-3 pt-2.5 pb-1 flex items-center gap-2">
          <button
            onClick={() => setShowTaskId(!showTaskId)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            <Hash size={11} />
            Task ID
          </button>
          <button
            onClick={queryTaskStatus}
            disabled={taskStatusLoading}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-xs text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50"
          >
            {taskStatusLoading ? <Loader2 size={11} className="animate-spin" /> : <Activity size={11} />}
            查询状态
          </button>
        </div>
      )}

      {/* Task ID panel */}
      {taskId && showTaskId && (
        <div className="mx-3 mb-2 px-3 py-2 rounded-xl bg-gray-800 border border-gray-700 flex items-center gap-2">
          <span className="flex-1 text-xs text-gray-300 font-mono break-all leading-relaxed">{taskId}</span>
          <button
            onClick={copyTaskId}
            className="flex-shrink-0 p-1 rounded-md hover:bg-gray-600 text-gray-500 hover:text-gray-300 transition-colors"
            title="复制"
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
          </button>
        </div>
      )}

      {/* Task status panel */}
      {showTaskStatus && (
        <div className="mx-3 mb-2 rounded-xl bg-gray-800 border border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
            <span className="text-xs font-medium text-gray-300">任务状态</span>
            <button
              onClick={() => setShowTaskStatus(false)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              关闭
            </button>
          </div>
          <div className="p-3 max-h-48 overflow-y-auto">
            {taskStatusLoading ? (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Loader2 size={12} className="animate-spin text-cyan-400" />
                查询中...
              </div>
            ) : taskStatus ? (
              <p className="text-xs font-mono text-gray-200">
                {(taskStatus as Record<string, Record<string, unknown>>)?.output?.task_status ?? '未知'}
              </p>
            ) : null}
          </div>
          {taskStatus && !taskStatusLoading && (
            <div className="px-3 pb-2.5">
              <button
                onClick={queryTaskStatus}
                className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <RefreshCw size={11} />
                刷新
              </button>
            </div>
          )}
        </div>
      )}

      {/* Timestamps */}
      {video.created_at && (
        <div className="mx-3 mb-2 px-3 py-2 rounded-xl bg-gray-800/60 border border-gray-700/60 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500 flex items-center gap-1"><Clock size={10} />发起时间</span>
            <span className="text-gray-400 font-mono">{new Date(video.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>
          {video.completed_at && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 flex items-center gap-1"><Check size={10} />完成时间</span>
              <span className="text-gray-400 font-mono">{new Date(video.completed_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>
          )}
          {video.completed_at && (
            <div className="flex items-center justify-between text-xs border-t border-gray-700/60 pt-1.5 mt-1">
              <span className="text-gray-500 flex items-center gap-1"><Timer size={10} />任务耗时</span>
              <span className="text-cyan-400 font-mono font-medium">
                {(() => {
                  const secs = Math.round((new Date(video.completed_at).getTime() - new Date(video.created_at).getTime()) / 1000);
                  return secs >= 60 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${secs}s`;
                })()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Recover button for failed tasks that have a task ID */}
      {video.status === 'failed' && !recoveredUrl && taskId && (
        <div className="px-3 pb-3">
          <button
            onClick={recoverFromTask}
            disabled={recovering}
            className="w-full flex items-center justify-center gap-1.5 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 text-xs font-medium rounded-xl transition-all disabled:opacity-50"
          >
            {recovering ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {recovering ? '获取结果中...' : '重新获取结果'}
          </button>
        </div>
      )}

      {(displayStatus === 'completed' || recoveredUrl) && (
        <div className="p-3 flex gap-2">
          <button
            onClick={() => {
              const url = recoveredUrl || video.video_url;
              if (!url) return;
              const a = document.createElement('a');
              a.href = url;
              a.download = `${video.title || (isImageAsset ? 'image' : 'video')}.${isImageAsset ? 'png' : 'mp4'}`;
              a.target = '_blank';
              a.rel = 'noopener noreferrer';
              a.click();
            }}
            disabled={!video.video_url && !recoveredUrl}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl text-xs text-gray-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={12} />
            下载
          </button>
          <button
            onClick={() => onQuickEdit?.(video.prompt)}
            disabled={!video.prompt}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl text-xs text-gray-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Wand2 size={12} />
            快速编辑
          </button>
          <button
            onClick={() => {
              if (!onRegenerate) return;
              onRegenerate({
                prompt: video.prompt,
                modelId: (meta?.model as string) || video.model,
                providerId: (meta?.provider as string) || '',
                dashscopeRegion: (meta?.dashscope_region as string) || 'intl',
                assetType: isImageAsset ? 'image' : 'video',
                duration: (meta?.duration as number) || video.duration || 5,
                resolution: (meta?.resolution as string) || video.resolution || '720P',
                ratio: (meta?.ratio as string) || '16:9',
                watermark: (meta?.watermark as boolean) || false,
                imgSize: ((meta?.img_size as string) || '2K') as '1K' | '2K' | '4K',
                imgN: (meta?.img_n as number) || 1,
                imageUrl: (meta?.image_url as string | null) || null,
              });
            }}
            disabled={!onRegenerate}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl text-xs text-gray-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCw size={12} />
            再生成
          </button>
        </div>
      )}
    </div>
  );
}
