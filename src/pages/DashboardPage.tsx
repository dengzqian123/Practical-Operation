import { useState, useEffect } from 'react';
import {
  Film, Sparkles, TrendingUp, Zap, ArrowRight, Clock,
  Check, AlertCircle, Loader2, Plus
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Video } from '../lib/database.types';

type Page = 'dashboard' | 'generate' | 'works' | 'projects' | 'explore' | 'settings' | 'profile';

const QUICK_PROMPTS = [
  { title: 'Cinematic Sunset', prompt: 'Aerial drone shot of a dramatic sunset over ocean waves crashing against rocky cliffs', style: 'Cinematic' },
  { title: 'Anime Cherry Blossoms', prompt: 'Anime girl standing under falling cherry blossoms, soft wind, peaceful spring afternoon', style: 'Anime' },
  { title: 'Space Journey', prompt: 'A spacecraft accelerating through a wormhole, stars stretching into light trails', style: 'Sci-Fi' },
  { title: 'Forest Time-lapse', prompt: 'Seasons changing in a forest from summer to winter, leaves falling, snow covering ground', style: 'Nature' },
];

interface DashboardPageProps {
  onNavigate: (page: Page, prompt?: string) => void;
}

export default function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { user, profile } = useAuth();
  const [recentVideos, setRecentVideos] = useState<Video[]>([]);
  const [stats, setStats] = useState({ total: 0, completed: 0, processing: 0, failed: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    const { data: videos } = await supabase
      .from('videos')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(6);

    if (videos) {
      setRecentVideos(videos);
      setStats({
        total: videos.length,
        completed: videos.filter((v) => v.status === 'completed').length,
        processing: videos.filter((v) => v.status === 'processing' || v.status === 'pending').length,
        failed: videos.filter((v) => v.status === 'failed').length,
      });
    }
    setLoading(false);
  };

  const statusConfig = {
    pending: { color: 'text-yellow-400', bg: 'bg-yellow-400/10', icon: Clock },
    processing: { color: 'text-blue-400', bg: 'bg-blue-400/10', icon: Loader2 },
    completed: { color: 'text-emerald-400', bg: 'bg-emerald-400/10', icon: Check },
    failed: { color: 'text-red-400', bg: 'bg-red-400/10', icon: AlertCircle },
  };

  const THUMB_FALLBACK = 'https://images.pexels.com/photos/956981/pexels-photo-956981.jpeg?auto=compress&cs=tinysrgb&w=80&h=60&fit=crop';

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Greeting */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-6">
        <p className="text-gray-400 text-sm mb-1">{greeting},</p>
        <h1 className="text-2xl font-bold text-white mb-2">
          {profile?.display_name || profile?.username || 'Creator'}
        </h1>
        <p className="text-gray-400 text-sm mb-5">Ready to create something amazing today?</p>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => onNavigate('generate')}
            className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-white text-sm font-medium rounded-xl transition-all"
          >
            <Sparkles size={15} />
            Generate Video
          </button>
          <button
            onClick={() => onNavigate('explore')}
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm font-medium rounded-xl transition-all"
          >
            <TrendingUp size={15} />
            Explore
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Videos', value: stats.total, icon: Film, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
          { label: 'Completed', value: stats.completed, icon: Check, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Processing', value: stats.processing, icon: Zap, color: 'text-blue-400', bg: 'bg-blue-500/10' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-4`}>
              <Icon size={18} className={color} />
            </div>
            <div className="text-2xl font-bold text-white mb-1">{value}</div>
            <div className="text-sm text-gray-400">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Generate */}
        <div className="lg:col-span-1 bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Quick Generate</h2>
            <Sparkles size={15} className="text-cyan-400" />
          </div>
          <div className="space-y-2">
            {QUICK_PROMPTS.map((qp) => (
              <button
                key={qp.title}
                onClick={() => onNavigate('generate', qp.prompt)}
                className="w-full text-left px-3 py-3 rounded-xl bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-gray-600 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white mb-0.5">{qp.title}</div>
                    <div className="text-xs text-gray-500 line-clamp-1">{qp.prompt}</div>
                  </div>
                  <ArrowRight size={14} className="text-gray-600 group-hover:text-cyan-400 flex-shrink-0 ml-2 transition-colors" />
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => onNavigate('generate')}
            className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 text-sm font-medium rounded-xl transition-all"
          >
            <Plus size={14} />
            Custom Prompt
          </button>
        </div>

        {/* Recent Videos */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Recent Videos</h2>
            <button
              onClick={() => onNavigate('works')}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
            >
              View all <ArrowRight size={12} />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-cyan-400" />
            </div>
          ) : recentVideos.length === 0 ? (
            <div className="text-center py-12">
              <Film size={32} className="text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No videos yet. Start generating!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentVideos.map((video) => {
                const s = statusConfig[video.status];
                const StatusIcon = s.icon;
                return (
                  <div key={video.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-800 transition-colors">
                    <div className="w-16 h-10 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0">
                      <img
                        src={video.thumbnail_url || THUMB_FALLBACK}
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{video.title}</div>
                      <div className="text-xs text-gray-500 truncate">{video.prompt}</div>
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${s.bg} flex-shrink-0`}>
                      <StatusIcon size={10} className={`${s.color} ${video.status === 'processing' ? 'animate-spin' : ''}`} />
                      <span className={`text-xs font-medium ${s.color} capitalize`}>{video.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
