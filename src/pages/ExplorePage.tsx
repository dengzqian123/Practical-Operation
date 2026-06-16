import { useState, useEffect } from 'react';
import { Heart, Eye, Search, Sparkles, TrendingUp, Loader2, Play } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Video } from '../lib/database.types';

const CATEGORIES = ['All', 'Cinematic', 'Anime', 'Nature', 'Sci-Fi', '3D Animation', 'Abstract', 'Documentary'];

const FEATURED_IMAGES = [
  'https://images.pexels.com/photos/1670977/pexels-photo-1670977.jpeg?auto=compress&cs=tinysrgb&w=600&h=338&fit=crop',
  'https://images.pexels.com/photos/2387418/pexels-photo-2387418.jpeg?auto=compress&cs=tinysrgb&w=600&h=338&fit=crop',
  'https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=600&h=338&fit=crop',
  'https://images.pexels.com/photos/1205301/pexels-photo-1205301.jpeg?auto=compress&cs=tinysrgb&w=600&h=338&fit=crop',
  'https://images.pexels.com/photos/956981/pexels-photo-956981.jpeg?auto=compress&cs=tinysrgb&w=600&h=338&fit=crop',
  'https://images.pexels.com/photos/1366919/pexels-photo-1366919.jpeg?auto=compress&cs=tinysrgb&w=600&h=338&fit=crop',
  'https://images.pexels.com/photos/315938/pexels-photo-315938.jpeg?auto=compress&cs=tinysrgb&w=600&h=338&fit=crop',
  'https://images.pexels.com/photos/1434608/pexels-photo-1434608.jpeg?auto=compress&cs=tinysrgb&w=600&h=338&fit=crop',
];

const DEMO_VIDEOS: Partial<Video>[] = [
  { id: '1', title: 'Martian Sunrise', prompt: 'A lone astronaut watches sunrise over red Martian valleys, dust storms swirling in the distance', style: 'cinematic', model: 'sora', duration: 10, resolution: '4K', likes_count: 1243, views_count: 18420, status: 'completed', is_public: true, thumbnail_url: FEATURED_IMAGES[0] },
  { id: '2', title: 'Bioluminescent Deep', prompt: 'Underwater city glowing with bioluminescent light, schools of alien fish swimming through crystal spires', style: 'sci-fi', model: 'runway-gen3', duration: 5, resolution: '1080p', likes_count: 892, views_count: 12304, status: 'completed', is_public: true, thumbnail_url: FEATURED_IMAGES[1] },
  { id: '3', title: 'Cherry Blossom Storm', prompt: 'Timelapse of cherry blossoms blooming, petals falling like pink snow over a wooden bridge', style: 'cinematic', model: 'kling', duration: 8, resolution: '1080p', likes_count: 2105, views_count: 31208, status: 'completed', is_public: true, thumbnail_url: FEATURED_IMAGES[2] },
  { id: '4', title: 'Steam Punk London', prompt: 'Victorian London from above, brass airships drifting through morning fog, Big Ben casting shadows', style: 'cinematic', model: 'sora', duration: 12, resolution: '4K', likes_count: 1567, views_count: 22105, status: 'completed', is_public: true, thumbnail_url: FEATURED_IMAGES[3] },
  { id: '5', title: 'Arctic Aurora', prompt: 'Northern lights dance over an arctic tundra, wolves silhouetted against green ribbons of light', style: 'nature', model: 'lumiere', duration: 15, resolution: '4K', likes_count: 3421, views_count: 48902, status: 'completed', is_public: true, thumbnail_url: FEATURED_IMAGES[4] },
  { id: '6', title: 'Jungle Temple', prompt: 'Ancient stone temple slowly being reclaimed by jungle, time-lapse vines consuming carved stones', style: 'documentary', model: 'runway-gen3', duration: 10, resolution: '1080p', likes_count: 678, views_count: 9043, status: 'completed', is_public: true, thumbnail_url: FEATURED_IMAGES[5] },
  { id: '7', title: 'Crystal Cave', prompt: 'Explorer with torch entering massive crystal cave, rainbow reflections on stalactites', style: '3d animation', model: 'stable-video', duration: 7, resolution: '1080p', likes_count: 934, views_count: 14321, status: 'completed', is_public: true, thumbnail_url: FEATURED_IMAGES[6] },
  { id: '8', title: 'Digital Dreamscape', prompt: 'Abstract neural network visualized as flowing golden threads forming human silhouettes', style: 'abstract', model: 'pika', duration: 6, resolution: '1080p', likes_count: 1892, views_count: 26547, status: 'completed', is_public: true, thumbnail_url: FEATURED_IMAGES[7] },
];

export default function ExplorePage() {
  const { user } = useAuth();
  const [videos, setVideos] = useState<Partial<Video>[]>(DEMO_VIDEOS);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) loadPublicVideos();
  }, [user]);

  const loadPublicVideos = async () => {
    const { data } = await supabase
      .from('videos')
      .select('*')
      .eq('is_public', true)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(20);

    if (data && data.length > 0) {
      setVideos([...DEMO_VIDEOS, ...data]);
    }
  };

  const toggleLike = async (videoId: string) => {
    if (!user) return;
    const isLiked = likedIds.has(videoId);

    if (isLiked) {
      setLikedIds((prev) => { const n = new Set(prev); n.delete(videoId); return n; });
      setVideos((prev) => prev.map((v) => v.id === videoId ? { ...v, likes_count: (v.likes_count ?? 0) - 1 } : v));
      await supabase.from('video_likes').delete().eq('user_id', user.id).eq('video_id', videoId);
    } else {
      setLikedIds((prev) => new Set([...prev, videoId]));
      setVideos((prev) => prev.map((v) => v.id === videoId ? { ...v, likes_count: (v.likes_count ?? 0) + 1 } : v));
      await supabase.from('video_likes').insert({ user_id: user.id, video_id: videoId });
    }
  };

  const filtered = videos.filter((v) => {
    const matchSearch = !search || v.title?.toLowerCase().includes(search.toLowerCase()) || v.prompt?.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === 'All' || v.style?.toLowerCase() === category.toLowerCase();
    return matchSearch && matchCat;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Hero */}
      <div className="mb-8 bg-gradient-to-br from-gray-800 via-gray-850 to-gray-900 border border-gray-700 rounded-2xl p-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-4">
          <TrendingUp size={13} className="text-cyan-400" />
          <span className="text-xs text-cyan-400 font-medium">Trending This Week</span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-3">Explore AI Videos</h1>
        <p className="text-gray-400 mb-6">Discover what creators are making with AI video models</p>

        <div className="relative max-w-md mx-auto">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search videos, styles, prompts..."
            className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all
              ${category === cat
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={28} className="animate-spin text-cyan-400" />
        </div>
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
          {filtered.map((video, i) => (
            <VideoCard
              key={video.id || i}
              video={video}
              liked={likedIds.has(video.id || '')}
              onLike={() => toggleLike(video.id || '')}
            />
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-24">
          <Sparkles size={40} className="text-gray-700 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-400">No videos found</h3>
        </div>
      )}
    </div>
  );
}

function VideoCard({ video, liked, onLike }: { video: Partial<Video>; liked: boolean; onLike: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="break-inside-avoid bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-700 transition-all duration-200 mb-4"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="relative">
        <img
          src={video.thumbnail_url || ''}
          alt={video.title}
          className="w-full object-cover"
        />
        {hovered && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity">
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Play size={18} className="text-white ml-0.5" fill="white" />
            </div>
          </div>
        )}
        <div className="absolute bottom-2 left-2 flex items-center gap-1">
          {video.duration && (
            <span className="px-1.5 py-0.5 rounded-full bg-black/60 text-white text-xs">{video.duration}s</span>
          )}
        </div>
      </div>

      <div className="p-3">
        <h3 className="font-medium text-white text-sm mb-1">{video.title}</h3>
        <p className="text-xs text-gray-500 line-clamp-2 mb-3">{video.prompt}</p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <button
              onClick={onLike}
              className={`flex items-center gap-1 transition-colors ${liked ? 'text-red-400' : 'hover:text-red-400'}`}
            >
              <Heart size={12} fill={liked ? 'currentColor' : 'none'} />
              {video.likes_count?.toLocaleString()}
            </button>
            <span className="flex items-center gap-1">
              <Eye size={12} />
              {video.views_count?.toLocaleString()}
            </span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-500 capitalize border border-gray-700">
            {video.model}
          </span>
        </div>
      </div>
    </div>
  );
}
