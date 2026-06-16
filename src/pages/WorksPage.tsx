import { useState, useEffect, useRef, useCallback } from 'react';
import { Film, Search, Grid3x3 as Grid3X3, List, Heart, Eye, Download, Share2, Trash2, CreditCard as Edit2, MoreHorizontal, Clock, Check, AlertCircle, Loader2, Play, Globe, Lock, X, RefreshCw, Copy, ChevronDown, ChevronUp, Activity, Hash, Link, ZoomIn, Image as ImageIcon, FolderOpen, ChevronRight, CalendarDays, Timer, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Video, Project } from '../lib/database.types';

const LS_KEY = (providerId: string) => `frameforge_apikey_${providerId}`;

interface TaskMeta {
  task_id: string;
  provider: string;
  model: string;
  dashscope_region: string;
}

type DashscopeStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED' | 'UNKNOWN';

interface TaskState {
  videoId: string;
  videoTitle: string;
  taskId: string;
  provider: string;
  dashscopeRegion: string;
  remoteStatus: DashscopeStatus | null;
  polling: boolean;
  lastChecked: Date | null;
  error: string | null;
  failReason: string | null;
  copiedId: boolean;
}

async function queryTask(taskId: string, provider: string, dashscopeRegion: string): Promise<{ status: DashscopeStatus; videoUrl?: string; imageUrl?: string; failReason?: string } | null> {
  const apiKey = localStorage.getItem(LS_KEY(provider));
  if (!apiKey) return null;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const { data: { session } } = await supabase.auth.getSession();
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/aliyun-video/task/${taskId}`, {
      headers: {
        'Authorization': `Bearer ${session?.access_token || anonKey}`,
        'X-Dashscope-Key': apiKey,
        'X-Dashscope-Region': dashscopeRegion || 'intl',
      },
    });
    const data = await res.json();
    const raw = data?.output?.video_url;
    const videoUrl: string | undefined = Array.isArray(raw) ? raw[0] : raw;

    // Image models return output.choices[n].message.content[n].image
    let imageUrl: string | undefined;
    const choices = data?.output?.choices;
    if (Array.isArray(choices) && choices.length > 0) {
      const content = choices[0]?.message?.content;
      if (Array.isArray(content)) {
        const imgItem = content.find((c: Record<string, string>) => c.type === 'image');
        imageUrl = imgItem?.image;
      }
    }

    return {
      status: data?.output?.task_status as DashscopeStatus,
      videoUrl,
      imageUrl,
      failReason: data?.output?.message || data?.message || undefined,
    };
  } catch {
    return null;
  }
}

type FilterStatus = 'all' | 'completed' | 'processing' | 'pending' | 'failed';
type FilterType = 'all' | 't2i' | 'i2i' | 't2v' | 'i2v';
type FilterProject = 'all' | 'none' | string; // 'none' = unclassified, string = project id
type FilterDate = 'all' | 'today' | 'yesterday' | '7d' | '30d' | 'custom';
type ViewMode = 'grid' | 'list';
type SortBy = 'newest' | 'oldest' | 'likes' | 'views';

function captureVideoFirstFrame(videoUrl: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'metadata';
    const cleanup = () => { video.src = ''; video.load(); };
    const fail = () => { cleanup(); resolve(null); };
    video.addEventListener('error', fail);
    video.addEventListener('loadeddata', () => { video.currentTime = 0; });
    video.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
        const ctx = canvas.getContext('2d');
        if (!ctx) return fail();
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => { cleanup(); resolve(blob); }, 'image/jpeg', 0.85);
      } catch { fail(); }
    });
    video.src = videoUrl;
    video.load();
  });
}

export default function WorksPage() {
  const { user, isAdmin } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterProject, setFilterProject] = useState<FilterProject>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [previewVideo, setPreviewVideo] = useState<Video | null>(null);
  const [tasks, setTasks] = useState<TaskState[]>([]);
  const [noTaskVideos, setNoTaskVideos] = useState<{ id: string; title: string }[]>([]);
  const [taskPanelOpen, setTaskPanelOpen] = useState(true);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [bindDialog, setBindDialog] = useState<{ videoId: string; videoTitle: string } | null>(null);
  const [bindInput, setBindInput] = useState('');
  const [retrying, setRetrying] = useState<Set<string>>(new Set());
  const [retryErrors, setRetryErrors] = useState<Record<string, string>>({});
  const [failReasons, setFailReasons] = useState<Record<string, string>>({});
  const [queryingFailReason, setQueryingFailReason] = useState<Set<string>>(new Set());
  const [projects, setProjects] = useState<Project[]>([]);
  const [userProfiles, setUserProfiles] = useState<{ id: string; username: string; display_name: string | null }[]>([]);
  const [filterUser, setFilterUser] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<FilterDate>('all');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showProjectSubmenu, setShowProjectSubmenu] = useState(false);
  const [showBulkMoveMenu, setShowBulkMoveMenu] = useState(false);

  useEffect(() => {
    if (user) {
      loadVideos();
      loadProjects();
    }
  }, [user, isAdmin, filterStatus, sortBy]);

  const loadVideos = async () => {
    setLoading(true);
    // Admin sees all videos across all users; regular users see only their own
    let query = isAdmin
      ? supabase.from('videos').select('*')
      : supabase.from('videos').select('*').eq('user_id', user!.id);

    if (filterStatus !== 'all') query = query.eq('status', filterStatus);

    if (sortBy === 'newest') query = query.order('created_at', { ascending: false });
    else if (sortBy === 'oldest') query = query.order('created_at', { ascending: true });
    else if (sortBy === 'likes') query = query.order('likes_count', { ascending: false });
    else if (sortBy === 'views') query = query.order('views_count', { ascending: false });

    const { data } = await query;
    setVideos(data || []);
    setLoading(false);

    // Load task monitor from all pending/processing videos regardless of filter
    loadActiveTasks();
  };

  const loadActiveTasks = useCallback(async () => {
    const { data } = await supabase
      .from('videos')
      .select('id, title, status, metadata')
      .eq('user_id', user!.id)
      .in('status', ['pending', 'processing']);

    if (!data) return;

    const newTasks: TaskState[] = [];
    const missing: { id: string; title: string }[] = [];
    for (const v of data) {
      const meta = v.metadata as Partial<TaskMeta> | null;
      if (!meta?.task_id) {
        missing.push({ id: v.id, title: v.title });
        continue;
      }
      newTasks.push({
        videoId: v.id,
        videoTitle: v.title,
        taskId: meta.task_id,
        provider: meta.provider || 'aliyun',
        dashscopeRegion: meta.dashscope_region || 'intl',
        remoteStatus: null,
        polling: false,
        lastChecked: null,
        error: null,
        failReason: null,
        copiedId: false,
      });
    }

    setNoTaskVideos(missing);
    setTasks((prev) => {
      // Merge: keep existing poll state for known tasks, add new ones
      const prevMap = new Map(prev.map((t) => [t.videoId, t]));
      return newTasks.map((t) => prevMap.get(t.videoId) || t);
    });
  }, [user]);

  const refreshTask = useCallback(async (videoId: string) => {
    setTasks((prev) => prev.map((t) => t.videoId === videoId ? { ...t, polling: true, error: null } : t));

    const task = tasks.find((t) => t.videoId === videoId);
    if (!task) return;

    const result = await queryTask(task.taskId, task.provider, task.dashscopeRegion);

    if (!result) {
      setTasks((prev) => prev.map((t) => t.videoId === videoId ? { ...t, polling: false, error: '查询失败，请检查 API Key 是否在本地浏览器中配置', lastChecked: new Date() } : t));
      return;
    }

    const now = new Date();
    setTasks((prev) => prev.map((t) => t.videoId === videoId ? { ...t, polling: false, remoteStatus: result.status, lastChecked: now, error: null } : t));

    // Update DB and local video list when terminal
    const assetUrl = result.imageUrl || result.videoUrl;
    if (result.status === 'SUCCEEDED' && assetUrl) {
      const isImage = !!result.imageUrl;
      let thumbnailUrl = assetUrl;

      if (!isImage) {
        // For video: use existing thumb or capture first frame
        const existingThumb = videos.find((v) => v.id === videoId)?.thumbnail_url || '';
        thumbnailUrl = existingThumb;
        if (!existingThumb) {
          const blob = await captureVideoFirstFrame(assetUrl);
          if (blob && user) {
            const path = `${user.id}/thumb_${videoId}.jpg`;
            const { error } = await supabase.storage.from('i2v-images').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
            if (!error) {
              const { data: { publicUrl } } = supabase.storage.from('i2v-images').getPublicUrl(path);
              thumbnailUrl = publicUrl;
            }
          }
        }
      }

      await supabase.from('videos').update({
        status: 'completed',
        thumbnail_url: thumbnailUrl || undefined,
        video_url: assetUrl,
        updated_at: new Date().toISOString(),
      }).eq('id', videoId);
      setVideos((v) => v.map((vid) => vid.id === videoId ? { ...vid, status: 'completed', thumbnail_url: thumbnailUrl || vid.thumbnail_url, video_url: assetUrl } : vid));
      setTasks((prev) => prev.filter((t) => t.videoId !== videoId));
    } else if (result.status === 'FAILED' || result.status === 'CANCELED') {
      await supabase.from('videos').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', videoId);
      setVideos((v) => v.map((vid) => vid.id === videoId ? { ...vid, status: 'failed' } : vid));
      setTasks((prev) => prev.map((t) => t.videoId === videoId ? { ...t, failReason: result.failReason || null } : t));
    }
  }, [tasks]);

  const queryFailReason = useCallback(async (videoId: string) => {
    const video = videos.find((v) => v.id === videoId);
    if (!video) return;
    const meta = video.metadata as { task_id?: string; provider?: string; dashscope_region?: string } | null;
    if (!meta?.task_id) {
      setFailReasons((prev) => ({ ...prev, [videoId]: '该作品未记录 Task ID，无法查询原因（任务可能在创建阶段就失败了）' }));
      return;
    }
    setQueryingFailReason((prev) => new Set(prev).add(videoId));
    const result = await queryTask(meta.task_id, meta.provider ?? 'aliyun', meta.dashscope_region ?? 'intl');
    setQueryingFailReason((prev) => { const s = new Set(prev); s.delete(videoId); return s; });
    if (!result) {
      setFailReasons((prev) => ({ ...prev, [videoId]: '查询失败，请检查 API Key 是否已在浏览器中配置' }));
    } else {
      setFailReasons((prev) => ({ ...prev, [videoId]: result.failReason || `任务状态：${result.status}，未返回具体原因` }));
    }
  }, [videos]);

  // Auto-poll all active tasks every 15s
  useEffect(() => {
    if (tasks.length === 0) return;
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);

    pollTimerRef.current = setTimeout(() => {
      tasks.forEach((t) => {
        if (!t.polling) refreshTask(t.videoId);
      });
    }, 15000);

    return () => { if (pollTimerRef.current) clearTimeout(pollTimerRef.current); };
  }, [tasks]);

  const bindTaskId = async () => {
    if (!bindDialog || !bindInput.trim()) return;
    const taskId = bindInput.trim();
    await supabase.from('videos').update({
      metadata: { task_id: taskId, provider: 'aliyun', model: '', dashscope_region: 'intl' },
      updated_at: new Date().toISOString(),
    }).eq('id', bindDialog.videoId);
    setBindDialog(null);
    setBindInput('');
    loadActiveTasks();
  };

  const retryGetTaskId = async (videoId: string) => {
    // Find the video to get its params
    const video = videos.find((v) => v.id === videoId) ||
      noTaskVideos.find((v) => v.id === videoId) as Video | undefined;
    if (!video) return;

    setRetrying((prev) => new Set(prev).add(videoId));
    setRetryErrors((prev) => { const n = { ...prev }; delete n[videoId]; return n; });

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const { data: { session } } = await supabase.auth.getSession();

      // Determine provider from model name — aliyun models all match known patterns
      const provider = 'aliyun';
      const apiKey = localStorage.getItem(LS_KEY(provider));
      if (!apiKey) {
        setRetryErrors((prev) => ({ ...prev, [videoId]: '未找到 API Key，请先在 API Keys 页面配置' }));
        setRetrying((prev) => { const n = new Set(prev); n.delete(videoId); return n; });
        return;
      }

      // Read full video record to get all params
      const { data: fullVideo } = await supabase.from('videos').select('*').eq('id', videoId).maybeSingle();
      if (!fullVideo) {
        setRetryErrors((prev) => ({ ...prev, [videoId]: '无法读取视频记录' }));
        setRetrying((prev) => { const n = new Set(prev); n.delete(videoId); return n; });
        return;
      }

      const meta = fullVideo.metadata as Record<string, unknown> | null;
      const region = (meta?.dashscope_region as string | undefined) || 'intl';

      const res = await fetch(`${supabaseUrl}/functions/v1/aliyun-video/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token || anonKey}`,
          'Content-Type': 'application/json',
          'X-Dashscope-Key': apiKey,
          'X-Dashscope-Region': region,
        },
        body: JSON.stringify({
          model: fullVideo.model,
          prompt: fullVideo.prompt,
          resolution: fullVideo.resolution || '720P',
          duration: fullVideo.duration || 5,
          ratio: (meta?.ratio as string | undefined) || '16:9',
        }),
      });

      const data = await res.json();
      console.log('[retry] DashScope response:', JSON.stringify(data));
      const taskId: string | undefined = data?.output?.task_id;

      if (taskId) {
        await supabase.from('videos').update({
          status: 'processing',
          metadata: { task_id: taskId, provider, model: fullVideo.model, dashscope_region: region },
          updated_at: new Date().toISOString(),
        }).eq('id', videoId);
        loadActiveTasks();
      } else {
        const errMsg = data?.message || data?.error || data?.code || JSON.stringify(data);
        setRetryErrors((prev) => ({ ...prev, [videoId]: `获取失败：${errMsg}` }));
      }
    } catch (e) {
      setRetryErrors((prev) => ({ ...prev, [videoId]: `请求异常：${String(e)}` }));
    } finally {
      setRetrying((prev) => { const n = new Set(prev); n.delete(videoId); return n; });
    }
  };

  const copyTaskId = (taskId: string, videoId: string) => {
    navigator.clipboard.writeText(taskId);
    setTasks((prev) => prev.map((t) => t.videoId === videoId ? { ...t, copiedId: true } : t));
    setTimeout(() => setTasks((prev) => prev.map((t) => t.videoId === videoId ? { ...t, copiedId: false } : t)), 2000);
  };

  const isImageAsset = (video: Video) => (video.metadata as Record<string, unknown> | null)?.asset_type === 'image';

  const getVideoType = (video: Video): FilterType => {
    const meta = video.metadata as Record<string, unknown> | null;
    const isImg = meta?.asset_type === 'image';
    const hasInputImage = !!(meta?.image_url);
    if (isImg) return hasInputImage ? 'i2i' : 't2i';
    return hasInputImage ? 'i2v' : 't2v';
  };

  const getDateRange = (): { from: Date | null; to: Date | null } => {
    const now = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    if (filterDate === 'today') {
      return { from: startOfDay(now), to: endOfDay(now) };
    }
    if (filterDate === 'yesterday') {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    if (filterDate === '7d') {
      const f = new Date(now); f.setDate(f.getDate() - 6);
      return { from: startOfDay(f), to: endOfDay(now) };
    }
    if (filterDate === '30d') {
      const f = new Date(now); f.setDate(f.getDate() - 29);
      return { from: startOfDay(f), to: endOfDay(now) };
    }
    if (filterDate === 'custom') {
      return {
        from: customDateFrom ? new Date(customDateFrom + 'T00:00:00') : null,
        to: customDateTo ? new Date(customDateTo + 'T23:59:59') : null,
      };
    }
    return { from: null, to: null };
  };

  const filteredVideos = videos.filter((v) => {
    const matchesSearch = v.title.toLowerCase().includes(search.toLowerCase()) || v.prompt.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === 'all' || getVideoType(v) === filterType;
    const matchesProject =
      filterProject === 'all' ? true :
      filterProject === 'none' ? !v.project_id :
      v.project_id === filterProject;
    const matchesUser = filterUser === 'all' || v.user_id === filterUser;
    let matchesDate = true;
    if (filterDate !== 'all') {
      const { from, to } = getDateRange();
      const created = new Date(v.created_at);
      if (from && created < from) matchesDate = false;
      if (to && created > to) matchesDate = false;
    }
    return matchesSearch && matchesType && matchesProject && matchesUser && matchesDate;
  });

  const filteredTotalSeconds = filteredVideos
    .filter((v) => v.status === 'completed' && !isImageAsset(v))
    .reduce((sum, v) => sum + (v.duration || 0), 0);

  const formatDuration = (totalSeconds: number) => {
    if (totalSeconds < 60) return `${totalSeconds}s`;
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const supabaseStorageBase = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/`;

  // Extract storage path from a Supabase public URL, returns null for external URLs
  const extractStoragePath = (url: string | null | undefined): { bucket: string; path: string } | null => {
    if (!url) return null;
    if (!url.startsWith(supabaseStorageBase)) return null;
    const rest = url.slice(supabaseStorageBase.length);
    const slashIdx = rest.indexOf('/');
    if (slashIdx === -1) return null;
    return { bucket: rest.slice(0, slashIdx), path: rest.slice(slashIdx + 1) };
  };

  const cleanStorageForVideos = async (videoList: Video[]) => {
    const pathsByBucket: Record<string, string[]> = {};
    for (const v of videoList) {
      for (const url of [v.thumbnail_url, v.video_url]) {
        const loc = extractStoragePath(url);
        if (!loc) continue;
        if (!pathsByBucket[loc.bucket]) pathsByBucket[loc.bucket] = [];
        pathsByBucket[loc.bucket].push(loc.path);
      }
    }
    await Promise.all(
      Object.entries(pathsByBucket).map(([bucket, paths]) =>
        supabase.storage.from(bucket).remove(paths)
      )
    );
  };

  const deleteSelected = () => {
    if (!selectedIds.size) return;
    setConfirmDialog({
      message: `确认删除选中的 ${selectedIds.size} 个作品？此操作不可撤销。`,
      onConfirm: async () => {
        const toDelete = videos.filter((v) => selectedIds.has(v.id));
        await supabase.from('videos').delete().in('id', Array.from(selectedIds));
        await cleanStorageForVideos(toDelete);
        setVideos((v) => v.filter((vid) => !selectedIds.has(vid.id)));
        setSelectedIds(new Set());
      },
    });
  };

  const togglePublic = async (video: Video) => {
    await supabase
      .from('videos')
      .update({ is_public: !video.is_public, updated_at: new Date().toISOString() })
      .eq('id', video.id);
    setVideos((v) => v.map((vid) => vid.id === video.id ? { ...vid, is_public: !vid.is_public } : vid));
  };

  const downloadAsset = (video: Video) => {
    if (!video.video_url) return;
    const isImg = isImageAsset(video);
    const a = document.createElement('a');
    a.href = video.video_url;
    a.download = `${video.title || (isImg ? 'image' : 'video')}.${isImg ? 'png' : 'mp4'}`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  };

  const deleteVideo = (id: string) => {
    setConfirmDialog({
      message: '确认删除此作品？此操作不可撤销。',
      onConfirm: async () => {
        const target = videos.find((v) => v.id === id);
        await supabase.from('videos').delete().eq('id', id);
        if (target) await cleanStorageForVideos([target]);
        setVideos((v) => v.filter((vid) => vid.id !== id));
      },
    });
  };

  const saveTitle = async () => {
    if (!editingVideo) return;
    await supabase
      .from('videos')
      .update({ title: editTitle, updated_at: new Date().toISOString() })
      .eq('id', editingVideo.id);
    setVideos((v) => v.map((vid) => vid.id === editingVideo.id ? { ...vid, title: editTitle } : vid));
    setEditingVideo(null);
  };

  const loadProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('id, name, description, cover_url, is_public, user_id, created_at, updated_at')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });
    if (data) setProjects(data as Project[]);
  };

  const loadUserProfiles = useCallback(async () => {
    if (!isAdmin) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name')
      .order('username', { ascending: true });
    if (data) setUserProfiles(data);
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) loadUserProfiles();
  }, [isAdmin, loadUserProfiles]);

  const moveToProject = async (videoId: string, projectId: string | null) => {
    await supabase
      .from('videos')
      .update({ project_id: projectId, updated_at: new Date().toISOString() })
      .eq('id', videoId);
    setVideos((v) => v.map((vid) => vid.id === videoId ? { ...vid, project_id: projectId } : vid));
    setOpenMenuId(null);
    setShowProjectSubmenu(false);
  };

  const moveSelectedToProject = async (projectId: string | null) => {
    const ids = Array.from(selectedIds);
    await supabase
      .from('videos')
      .update({ project_id: projectId, updated_at: new Date().toISOString() })
      .in('id', ids);
    setVideos((v) => v.map((vid) => selectedIds.has(vid.id) ? { ...vid, project_id: projectId } : vid));
    setShowBulkMoveMenu(false);
    setSelectedIds(new Set());
  };

  const statusConfig = {
    pending: { color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20', icon: Clock, label: 'Queued' },
    processing: { color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20', icon: Loader2, label: 'Processing' },
    completed: { color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20', icon: Check, label: 'Done' },
    failed: { color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/20', icon: AlertCircle, label: 'Failed' },
  };

  const THUMBNAIL_FALLBACK = 'https://images.pexels.com/photos/956981/pexels-photo-956981.jpeg?auto=compress&cs=tinysrgb&w=400&h=225&fit=crop';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white">{isAdmin ? '全部作品' : 'My Works'}</h1>
            {isAdmin && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400 font-medium">管理员视图</span>
            )}
          </div>
          <p className="text-gray-400 text-sm mt-0.5">
            {isAdmin ? `共 ${videos.length} 件公开作品（所有用户）` : `${videos.length} videos total`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <>
              {/* Bulk move to project */}
              <div className="relative">
                <button
                  onClick={() => setShowBulkMoveMenu(!showBulkMoveMenu)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-xl text-sm transition-all"
                >
                  <FolderOpen size={14} />
                  移动到项目
                  <ChevronDown size={13} className="text-gray-400" />
                </button>
                {showBulkMoveMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowBulkMoveMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 w-48 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-20 overflow-hidden">
                      <div className="px-3 py-2 border-b border-gray-700/60">
                        <span className="text-xs text-gray-400">将 {selectedIds.size} 个作品移动到</span>
                      </div>
                      <button
                        onClick={() => moveSelectedToProject(null)}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                      >
                        <X size={12} className="text-gray-500" />
                        不归类（移出项目）
                      </button>
                      {projects.length > 0 && <div className="border-t border-gray-700/60" />}
                      {projects.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => moveSelectedToProject(p.id)}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                        >
                          <FolderOpen size={12} className="text-cyan-400 flex-shrink-0" />
                          <span className="truncate">{p.name}</span>
                        </button>
                      ))}
                      {projects.length === 0 && (
                        <div className="px-3 py-3 text-xs text-gray-500">暂无项目</div>
                      )}
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={deleteSelected}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl text-sm transition-all"
              >
                <Trash2 size={14} />
                删除 ({selectedIds.size})
              </button>
            </>
          )}
        </div>
      </div>

      {/* Task Monitor Panel — hidden */}
      {false && (tasks.length > 0 || noTaskVideos.length > 0) && (
        <div className="mb-6 bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
          <button
            onClick={() => setTaskPanelOpen(!taskPanelOpen)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-800/50 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Activity size={15} className="text-cyan-400" />
              <span className="text-sm font-semibold text-white">生成任务监控</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/20 text-blue-400 font-medium">
                {tasks.length + noTaskVideos.length} 个进行中
              </span>
              <span className="text-xs text-gray-500">每 15 秒自动轮询</span>
            </div>
            {taskPanelOpen ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
          </button>

          {taskPanelOpen && (
            <div className="border-t border-gray-800 divide-y divide-gray-800">
              {noTaskVideos.map((v) => (
                <div key={v.id} className="px-5 py-3.5 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate mb-0.5">{v.title}</div>
                    {retryErrors[v.id] ? (
                      <div className="text-xs text-red-400 break-all leading-relaxed">{retryErrors[v.id]}</div>
                    ) : (
                      <div className="text-xs text-yellow-400/80">未获取到 Task ID，点击"重新获取"重新提交生成请求</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                    <button
                      onClick={() => retryGetTaskId(v.id)}
                      disabled={retrying.has(v.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 text-xs rounded-xl transition-colors disabled:opacity-50"
                    >
                      {retrying.has(v.id) ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                      {retrying.has(v.id) ? '获取中...' : '重新获取'}
                    </button>
                    <button
                      onClick={() => { setBindDialog({ videoId: v.id, videoTitle: v.title }); setBindInput(''); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 hover:text-gray-200 text-xs rounded-xl transition-colors"
                    >
                      <Link size={12} />
                      手动绑定
                    </button>
                  </div>
                </div>
              ))}
              {tasks.map((task) => {
                const statusMap: Record<string, { label: string; color: string; bg: string }> = {
                  PENDING:   { label: '排队中',  color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20' },
                  RUNNING:   { label: '生成中',  color: 'text-blue-400',   bg: 'bg-blue-400/10 border-blue-400/20'   },
                  SUCCEEDED: { label: '已完成',  color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20' },
                  FAILED:    { label: '失败',    color: 'text-red-400',    bg: 'bg-red-400/10 border-red-400/20'     },
                  CANCELED:  { label: '已取消',  color: 'text-gray-400',   bg: 'bg-gray-700 border-gray-600'         },
                };
                const s = task.remoteStatus ? statusMap[task.remoteStatus] : null;

                return (
                  <div key={task.videoId} className="border-b border-gray-800/50 last:border-0">
                    <div className="px-5 py-3.5 flex flex-wrap items-center gap-3">
                    {/* Title */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate mb-0.5">{task.videoTitle}</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-xs text-gray-400 font-mono bg-gray-800 px-2 py-0.5 rounded-lg border border-gray-700 select-all">
                          {task.taskId}
                        </code>
                        <button
                          onClick={() => copyTaskId(task.taskId, task.videoId)}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-cyan-400 transition-colors"
                        >
                          {task.copiedId ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                          {task.copiedId ? '已复制' : '复制'}
                        </button>
                      </div>
                    </div>

                    {/* Status badge */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {s ? (
                        <span className={`text-xs px-2 py-1 rounded-full border font-medium ${s.bg} ${s.color}`}>
                          {s.label}
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded-full border bg-gray-800 border-gray-700 text-gray-400">
                          未查询
                        </span>
                      )}

                      {task.lastChecked && (
                        <span className="text-xs text-gray-600">
                          {task.lastChecked.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} 查询
                        </span>
                      )}

                      {task.error && (
                        <span className="text-xs text-red-400 max-w-xs truncate" title={task.error}>
                          {task.error}
                        </span>
                      )}

                      <button
                        onClick={() => refreshTask(task.videoId)}
                        disabled={task.polling}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-xs rounded-xl transition-colors disabled:opacity-50"
                      >
                        <RefreshCw size={12} className={task.polling ? 'animate-spin' : ''} />
                        {task.polling ? '查询中' : (task.remoteStatus === 'FAILED' ? '查询原因' : '刷新')}
                      </button>
                    </div>
                  </div>
                  {task.failReason && (
                    <div className="px-5 pb-3 flex items-start gap-2">
                      <AlertCircle size={13} className="text-red-400 mt-0.5 flex-shrink-0" />
                      <span className="text-xs text-red-300 leading-relaxed break-all">{task.failReason}</span>
                    </div>
                  )}
                </div>
                );              })}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 space-y-3">
        {/* Row 1: Type tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium w-14 flex-shrink-0">生成类型</span>
          <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
            {([
              { key: 'all', label: '全部' },
              { key: 't2i', label: '文生图' },
              { key: 'i2i', label: '图生图' },
              { key: 't2v', label: '文生视频' },
              { key: 'i2v', label: '图生视频' },
            ] as { key: FilterType; label: string }[]).map(({ key, label }) => {
              const count = key === 'all' ? videos.length : videos.filter((v) => getVideoType(v) === key).length;
              return (
                <button
                  key={key}
                  onClick={() => setFilterType(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                    ${filterType === key ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                >
                  {label}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium transition-all
                    ${filterType === key ? 'bg-gray-600 text-gray-300' : 'bg-gray-800 text-gray-500'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 2: Project tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium w-14 flex-shrink-0">所属项目</span>
          <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 flex-wrap">
            {([
              { key: 'all', label: '全部' },
              { key: 'none', label: '未归类' },
              ...projects.map((p) => ({ key: p.id, label: p.name })),
            ] as { key: FilterProject; label: string }[]).map(({ key, label }) => {
              const count =
                key === 'all' ? videos.length :
                key === 'none' ? videos.filter((v) => !v.project_id).length :
                videos.filter((v) => v.project_id === key).length;
              return (
                <button
                  key={key}
                  onClick={() => setFilterProject(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                    ${filterProject === key ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                >
                  {key !== 'all' && key !== 'none' && <FolderOpen size={10} className="flex-shrink-0" />}
                  {label}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium transition-all
                    ${filterProject === key ? 'bg-gray-600 text-gray-300' : 'bg-gray-800 text-gray-500'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 3: Date filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium w-14 flex-shrink-0">时间范围</span>
          <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
            {([
              { key: 'all', label: '全部' },
              { key: 'today', label: '今天' },
              { key: 'yesterday', label: '昨天' },
              { key: '7d', label: '近7天' },
              { key: '30d', label: '近30天' },
              { key: 'custom', label: '自定义' },
            ] as { key: FilterDate; label: string }[]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilterDate(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                  ${filterDate === key ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}
              >
                {key === 'custom' && <CalendarDays size={11} />}
                {label}
              </button>
            ))}
          </div>
          {filterDate === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customDateFrom}
                onChange={(e) => setCustomDateFrom(e.target.value)}
                className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors [color-scheme:dark]"
              />
              <span className="text-xs text-gray-600">—</span>
              <input
                type="date"
                value={customDateTo}
                onChange={(e) => setCustomDateTo(e.target.value)}
                className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors [color-scheme:dark]"
              />
              {(customDateFrom || customDateTo) && (
                <button
                  onClick={() => { setCustomDateFrom(''); setCustomDateTo(''); }}
                  className="p-1 text-gray-600 hover:text-gray-300 transition-colors"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Row 4: User filter (admin only) */}
        {isAdmin && userProfiles.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 font-medium w-14 flex-shrink-0">按用户</span>
            <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 flex-wrap">
              {([
                { key: 'all', label: '全部用户' },
                ...userProfiles.map((p) => ({ key: p.id, label: p.display_name || p.username })),
              ] as { key: string; label: string }[]).map(({ key, label }) => {
                const count = key === 'all' ? videos.length : videos.filter((v) => v.user_id === key).length;
                return (
                  <button
                    key={key}
                    onClick={() => setFilterUser(key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                      ${filterUser === key ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                  >
                    {label}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium transition-all
                      ${filterUser === key ? 'bg-gray-600 text-gray-300' : 'bg-gray-800 text-gray-500'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Row 4: Search + status + sort + view */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索作品..."
              className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-xl p-1">
            {([
              { key: 'all', label: '全部' },
              { key: 'completed', label: '完成' },
              { key: 'processing', label: '生成中' },
              { key: 'pending', label: '排队' },
              { key: 'failed', label: '失败' },
            ] as { key: FilterStatus; label: string }[]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilterStatus(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                  ${filterStatus === key ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}
              >
                {label}
              </button>
            ))}
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="newest">最新</option>
            <option value="oldest">最早</option>
            <option value="likes">最多点赞</option>
            <option value="views">最多浏览</option>
          </select>

          <div className="flex bg-gray-800 border border-gray-700 rounded-xl p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}
            >
              <Grid3X3 size={15} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Filter results summary */}
      {!loading && (
        <div className="mb-4 flex items-center gap-3 px-1 flex-wrap">
          {/* Select-all checkbox */}
          {filteredVideos.length > 0 && (
            <button
              onClick={() => {
                const allIds = new Set(filteredVideos.map((v) => v.id));
                const allSelected = filteredVideos.every((v) => selectedIds.has(v.id));
                setSelectedIds(allSelected ? new Set() : allIds);
              }}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors group"
              title="全选/取消全选当前筛选结果"
            >
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all flex-shrink-0
                ${filteredVideos.every((v) => selectedIds.has(v.id))
                  ? 'bg-cyan-500 border-cyan-500'
                  : filteredVideos.some((v) => selectedIds.has(v.id))
                  ? 'border-cyan-500 bg-cyan-500/20'
                  : 'border-gray-600 group-hover:border-gray-400'}`}
              >
                {filteredVideos.every((v) => selectedIds.has(v.id))
                  ? <Check size={9} className="text-white" />
                  : filteredVideos.some((v) => selectedIds.has(v.id))
                  ? <div className="w-2 h-0.5 bg-cyan-400 rounded-full" />
                  : null}
              </div>
              <span>全选</span>
            </button>
          )}
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="text-gray-400 font-medium">{filteredVideos.length}</span>
            <span>个结果</span>
            {filterDate !== 'all' && (
              <span className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <CalendarDays size={10} />
                {filterDate === 'today' ? '今天' :
                 filterDate === 'yesterday' ? '昨天' :
                 filterDate === '7d' ? '近7天' :
                 filterDate === '30d' ? '近30天' :
                 (customDateFrom || customDateTo)
                   ? `${customDateFrom || '…'} — ${customDateTo || '…'}`
                   : '自定义'}
              </span>
            )}
          </div>
          {filteredTotalSeconds > 0 && (
            <>
              <span className="text-gray-700">·</span>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Clock size={11} className="text-cyan-400" />
                视频总时长
                <span className="text-white font-semibold tabular-nums">{formatDuration(filteredTotalSeconds)}</span>
              </div>
            </>
          )}
          {(filterDate !== 'all' || filterType !== 'all' || filterProject !== 'all' || filterUser !== 'all') && (
            <>
              <span className="text-gray-700">·</span>
              <button
                onClick={() => { setFilterDate('all'); setFilterType('all'); setFilterProject('all'); setFilterUser('all'); setCustomDateFrom(''); setCustomDateTo(''); setSearch(''); }}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
              >
                <X size={11} />
                清除筛选
              </button>
            </>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={28} className="animate-spin text-cyan-400" />
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="text-center py-24">
          <Film size={40} className="text-gray-700 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-400 mb-2">No videos found</h3>
          <p className="text-gray-600 text-sm">
            {search ? 'Try a different search term' : 'Generate your first video to see it here'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredVideos.map((video) => {
            const s = statusConfig[video.status];
            const StatusIcon = s.icon;
            const selected = selectedIds.has(video.id);

            return (
              <div
                key={video.id}
                className={`group bg-gray-900 rounded-2xl overflow-hidden border transition-all duration-200 hover:border-gray-600
                  ${selected ? 'border-cyan-500/50 ring-1 ring-cyan-500/20' : 'border-gray-800'}`}
              >
                {/* Thumbnail */}
                <div
                  className="relative aspect-video bg-gray-800 cursor-pointer"
                  onClick={() => video.status === 'completed' && setPreviewVideo(video)}
                >
                  <img
                    src={video.thumbnail_url || THUMBNAIL_FALLBACK}
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />

                  {video.status === 'completed' && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        {isImageAsset(video)
                          ? <ZoomIn size={18} className="text-white" />
                          : <Play size={18} className="text-white ml-0.5" fill="white" />
                        }
                      </div>
                    </div>
                  )}

                  {/* Select checkbox */}
                  <div
                    onClick={(e) => { e.stopPropagation(); toggleSelect(video.id); }}
                    className={`absolute top-2 left-2 w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-all
                      ${selected ? 'bg-cyan-500 border-cyan-500' : 'border-white/50 opacity-0 group-hover:opacity-100 bg-black/30'}`}
                  >
                    {selected && <Check size={10} className="text-white" />}
                  </div>

                  {/* Status */}
                  <div className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${s.bg} ${s.color}`}>
                    <StatusIcon size={10} className={video.status === 'processing' ? 'animate-spin' : ''} />
                    {s.label}
                  </div>

                  {video.status === 'completed' && !isImageAsset(video) && (
                    <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/60 text-white text-xs">
                      {video.duration}s
                    </div>
                  )}
                  {video.status === 'completed' && isImageAsset(video) && (
                    <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/60 text-white text-xs flex items-center gap-1">
                      <ImageIcon size={10} />
                      {video.resolution}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-sm font-medium text-white truncate flex-1">{video.title}</h3>
                    <div className="relative flex-shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === video.id ? null : video.id); setShowProjectSubmenu(false); }}
                        className="p-1 text-gray-500 hover:text-white transition-colors"
                      >
                        <MoreHorizontal size={15} />
                      </button>
                      {openMenuId === video.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => { setOpenMenuId(null); setShowProjectSubmenu(false); }} />
                          <div className="absolute right-0 top-full mt-1 w-44 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-20 overflow-hidden">
                            <button
                              onClick={() => { setEditingVideo(video); setEditTitle(video.title); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                            >
                              <Edit2 size={12} /> 重命名
                            </button>
                            <button
                              onClick={() => { togglePublic(video); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                            >
                              {video.is_public ? <Lock size={12} /> : <Globe size={12} />}
                              {video.is_public ? '设为私有' : '公开'}
                            </button>
                            <button
                              onClick={() => downloadAsset(video)}
                              disabled={!video.video_url}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-gray-300 hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Download size={12} /> 下载
                            </button>
                            {/* Move to project */}
                            <div className="relative">
                              <button
                                onClick={() => setShowProjectSubmenu(!showProjectSubmenu)}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                              >
                                <FolderOpen size={12} />
                                <span className="flex-1 text-left">移动到项目</span>
                                <ChevronRight size={11} className="text-gray-500" />
                              </button>
                              {showProjectSubmenu && (
                                <div className="absolute right-full top-0 mr-1 w-44 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-30 overflow-hidden">
                                  <button
                                    onClick={() => moveToProject(video.id, null)}
                                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-gray-700 transition-colors ${!video.project_id ? 'text-cyan-400' : 'text-gray-300'}`}
                                  >
                                    {!video.project_id && <Check size={11} />}
                                    {video.project_id && <span className="w-3" />}
                                    不归类
                                  </button>
                                  {projects.map((p) => (
                                    <button
                                      key={p.id}
                                      onClick={() => moveToProject(video.id, p.id)}
                                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-gray-700 transition-colors ${video.project_id === p.id ? 'text-cyan-400' : 'text-gray-300'}`}
                                    >
                                      {video.project_id === p.id ? <Check size={11} /> : <span className="w-3" />}
                                      <span className="truncate">{p.name}</span>
                                    </button>
                                  ))}
                                  {projects.length === 0 && (
                                    <div className="px-3 py-3 text-xs text-gray-500">暂无项目</div>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="border-t border-gray-700/60" />
                            <button
                              onClick={() => { deleteVideo(video.id); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 size={12} /> 删除
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 line-clamp-2 mb-2">{video.prompt}</p>

                  {/* Timestamps */}
                  <div className="mb-3 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 flex items-center gap-1"><Clock size={10} />发起</span>
                      <span className="text-gray-500 font-mono">{new Date(video.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    {video.completed_at && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600 flex items-center gap-1"><CheckCircle2 size={10} />完成</span>
                        <span className="text-gray-500 font-mono">{new Date(video.completed_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    )}
                    {video.completed_at && (
                      <div className="flex items-center justify-between text-xs border-t border-gray-700/50 pt-1 mt-0.5">
                        <span className="text-gray-600 flex items-center gap-1"><Timer size={10} />耗时</span>
                        <span className="text-cyan-500 font-mono font-medium">
                          {(() => {
                            const secs = Math.round((new Date(video.completed_at).getTime() - new Date(video.created_at).getTime()) / 1000);
                            return secs >= 60 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${secs}s`;
                          })()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Heart size={11} /> {video.likes_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye size={11} /> {video.views_count}
                      </span>
                    </div>
                    <span className="capitalize">{video.model}</span>
                  </div>

                  <div className="flex items-center gap-1 mt-2">
                    {video.is_public && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Public
                      </span>
                    )}
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-500 border border-gray-700 capitalize">
                      {video.style}
                    </span>
                  </div>

                  {video.status === 'completed' && video.video_url && (
                    <button
                      onClick={() => downloadAsset(video)}
                      className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 rounded-xl text-xs text-gray-300 hover:text-white transition-all"
                    >
                      <Download size={12} />
                      {isImageAsset(video) ? '下载图片' : '下载视频'}
                    </button>
                  )}

                  {video.status === 'failed' && (
                    <div className="mt-3">
                      <button
                        onClick={() => queryFailReason(video.id)}
                        disabled={queryingFailReason.has(video.id)}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 rounded-xl text-xs text-red-400 hover:text-red-300 transition-all disabled:opacity-50"
                      >
                        {queryingFailReason.has(video.id) ? <Loader2 size={12} className="animate-spin" /> : <AlertCircle size={12} />}
                        {queryingFailReason.has(video.id) ? '查询中...' : '查询失败原因'}
                      </button>
                      {failReasons[video.id] && (
                        <div className="mt-2 px-3 py-2 bg-red-500/5 border border-red-500/15 rounded-xl">
                          <p className="text-xs text-red-300 leading-relaxed break-all">{failReasons[video.id]}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List view */
        <div className="space-y-2">
          {filteredVideos.map((video) => {
            const s = statusConfig[video.status];
            const StatusIcon = s.icon;
            const selected = selectedIds.has(video.id);

            return (
              <div
                key={video.id}
                className={`flex items-center gap-4 bg-gray-900 border rounded-2xl p-4 transition-all
                  ${selected ? 'border-cyan-500/50 ring-1 ring-cyan-500/20' : 'border-gray-800 hover:border-gray-700'}`}
              >
                {/* Row checkbox */}
                <div
                  onClick={() => toggleSelect(video.id)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-all flex-shrink-0
                    ${selected ? 'bg-cyan-500 border-cyan-500' : 'border-gray-600 hover:border-gray-400'}`}
                >
                  {selected && <Check size={10} className="text-white" />}
                </div>
                <div className="w-24 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-gray-800">
                  <img
                    src={video.thumbnail_url || THUMBNAIL_FALLBACK}
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-medium text-white truncate">{video.title}</h3>
                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium flex-shrink-0 ${s.bg} ${s.color}`}>
                      <StatusIcon size={9} className={video.status === 'processing' ? 'animate-spin' : ''} />
                      {s.label}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{video.prompt}</p>
                </div>

                <div className="hidden md:flex items-center gap-6 text-xs text-gray-500 flex-shrink-0">
                  <span>{video.model}</span>
                  <span className="capitalize">{video.style}</span>
                  <span>{isImageAsset(video) ? video.resolution : `${video.duration}s · ${video.resolution}`}</span>
                  <span className="flex items-center gap-1"><Heart size={11} /> {video.likes_count}</span>
                </div>

                <div className="hidden lg:flex flex-col gap-1 text-xs flex-shrink-0 min-w-[160px]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gray-600 flex items-center gap-1"><Clock size={10} />发起</span>
                    <span className="text-gray-500 font-mono">{new Date(video.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  {video.completed_at && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-gray-600 flex items-center gap-1"><CheckCircle2 size={10} />完成</span>
                      <span className="text-gray-500 font-mono">{new Date(video.completed_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  )}
                  {video.completed_at && (
                    <div className="flex items-center justify-between gap-3 border-t border-gray-700/50 pt-1 mt-0.5">
                      <span className="text-gray-600 flex items-center gap-1"><Timer size={10} />耗时</span>
                      <span className="text-cyan-500 font-mono font-medium">
                        {(() => {
                          const secs = Math.round((new Date(video.completed_at).getTime() - new Date(video.created_at).getTime()) / 1000);
                          return secs >= 60 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${secs}s`;
                        })()}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => togglePublic(video)}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                    title={video.is_public ? 'Make Private' : 'Make Public'}
                  >
                    {video.is_public ? <Globe size={14} className="text-emerald-400" /> : <Lock size={14} />}
                  </button>
                  {video.status === 'completed' && video.video_url ? (
                    <button
                      onClick={() => downloadAsset(video)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 rounded-lg text-xs text-gray-300 hover:text-white transition-all"
                    >
                      <Download size={12} />
                      下载
                    </button>
                  ) : video.status === 'failed' ? (
                    <div className="flex flex-col items-end gap-1">
                      <button
                        onClick={() => queryFailReason(video.id)}
                        disabled={queryingFailReason.has(video.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-xs text-red-400 hover:text-red-300 transition-all disabled:opacity-50"
                      >
                        {queryingFailReason.has(video.id) ? <Loader2 size={12} className="animate-spin" /> : <AlertCircle size={12} />}
                        {queryingFailReason.has(video.id) ? '查询中' : '查询原因'}
                      </button>
                      {failReasons[video.id] && (
                        <p className="text-xs text-red-300 max-w-[200px] text-right leading-relaxed break-all">{failReasons[video.id]}</p>
                      )}
                    </div>
                  ) : (
                    <button
                      disabled
                      className="p-2 text-gray-600 cursor-not-allowed"
                      title="Not available"
                    >
                      <Download size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => deleteVideo(video.id)}
                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit modal */}
      {editingVideo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">Rename Video</h3>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-500 mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={saveTitle} className="flex-1 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-white font-medium text-sm rounded-xl transition-colors">
                Save
              </button>
              <button onClick={() => setEditingVideo(null)} className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-xl transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {previewVideo && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewVideo(null)}
        >
          <div
            className={`bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden w-full ${isImageAsset(previewVideo) ? 'max-w-2xl' : 'max-w-3xl'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <div className="flex items-center gap-2 min-w-0">
                {isImageAsset(previewVideo)
                  ? <ImageIcon size={15} className="text-amber-400 flex-shrink-0" />
                  : <Play size={15} className="text-cyan-400 flex-shrink-0" />
                }
                <h3 className="font-semibold text-white truncate">{previewVideo.title}</h3>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                {previewVideo.video_url && (
                  <button
                    onClick={() => downloadAsset(previewVideo)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white text-xs rounded-lg transition-colors"
                  >
                    <Download size={13} />
                    {isImageAsset(previewVideo) ? '下载图片' : '下载视频'}
                  </button>
                )}
                <button onClick={() => setPreviewVideo(null)} className="p-1.5 text-gray-400 hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Media area */}
            {isImageAsset(previewVideo) ? (
              <div className="bg-gray-950 flex items-center justify-center p-4 min-h-64 max-h-[70vh] overflow-hidden">
                <img
                  src={previewVideo.video_url || previewVideo.thumbnail_url || THUMBNAIL_FALLBACK}
                  alt={previewVideo.title}
                  className="max-w-full max-h-[65vh] object-contain rounded-lg"
                />
              </div>
            ) : (
              <div className="aspect-video bg-black">
                {previewVideo.video_url ? (
                  <video
                    src={previewVideo.video_url}
                    poster={previewVideo.thumbnail_url || THUMBNAIL_FALLBACK}
                    controls
                    autoPlay
                    className="w-full h-full"
                  />
                ) : (
                  <img src={previewVideo.thumbnail_url || THUMBNAIL_FALLBACK} alt={previewVideo.title} className="w-full h-full object-cover" />
                )}
              </div>
            )}

            <div className="p-5">
              <p className="text-sm text-gray-400 mb-3">{previewVideo.prompt}</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 bg-gray-800 rounded-lg text-gray-400 capitalize">{previewVideo.model}</span>
                <span className="px-2 py-1 bg-gray-800 rounded-lg text-gray-400 capitalize">{previewVideo.style}</span>
                {!isImageAsset(previewVideo) && <span className="px-2 py-1 bg-gray-800 rounded-lg text-gray-400">{previewVideo.duration}s</span>}
                <span className="px-2 py-1 bg-gray-800 rounded-lg text-gray-400">{previewVideo.resolution}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bind Task ID dialog */}
      {bindDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center flex-shrink-0">
                <Hash size={16} className="text-yellow-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">绑定 Task ID</h3>
                <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{bindDialog.videoTitle}</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-3 leading-relaxed">
              将阿里云 DashScope 返回的 Task ID 粘贴到下方，系统将用它来查询生成进度。
            </p>
            <input
              type="text"
              value={bindInput}
              onChange={(e) => setBindInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && bindTaskId()}
              placeholder="例如：video-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-cyan-500 mb-4 placeholder-gray-600"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={bindTaskId}
                disabled={!bindInput.trim()}
                className="flex-1 py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-sm rounded-xl transition-colors"
              >
                绑定并查询
              </button>
              <button
                onClick={() => setBindDialog(null)}
                className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-xl transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

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
