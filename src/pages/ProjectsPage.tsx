import { useState, useEffect } from 'react';
import { FolderOpen, Plus, Globe, Lock, Film, CreditCard as Edit2, Trash2, Loader2, X, Check, MoreHorizontal } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Project } from '../lib/database.types';

const COVER_IMAGES = [
  'https://images.pexels.com/photos/1670977/pexels-photo-1670977.jpeg?auto=compress&cs=tinysrgb&w=600&h=338&fit=crop',
  'https://images.pexels.com/photos/2387418/pexels-photo-2387418.jpeg?auto=compress&cs=tinysrgb&w=600&h=338&fit=crop',
  'https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=600&h=338&fit=crop',
  'https://images.pexels.com/photos/1205301/pexels-photo-1205301.jpeg?auto=compress&cs=tinysrgb&w=600&h=338&fit=crop',
  'https://images.pexels.com/photos/956981/pexels-photo-956981.jpeg?auto=compress&cs=tinysrgb&w=600&h=338&fit=crop',
  'https://images.pexels.com/photos/1366919/pexels-photo-1366919.jpeg?auto=compress&cs=tinysrgb&w=600&h=338&fit=crop',
];

interface ProjectWithCount extends Project {
  videoCount?: number;
}

export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [form, setForm] = useState({ name: '', description: '', is_public: false });
  const [saving, setSaving] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (user) loadProjects();
  }, [user]);

  const loadProjects = async () => {
    setLoading(true);
    const { data: projs } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });

    if (projs) {
      const withCounts = await Promise.all(
        projs.map(async (p) => {
          const { count } = await supabase
            .from('videos')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', p.id);
          return { ...p, videoCount: count ?? 0 };
        })
      );
      setProjects(withCounts);
    }
    setLoading(false);
  };

  const openCreate = () => {
    setForm({ name: '', description: '', is_public: false });
    setEditingProject(null);
    setShowCreate(true);
  };

  const openEdit = (project: Project) => {
    setForm({ name: project.name, description: project.description, is_public: project.is_public });
    setEditingProject(project);
    setShowCreate(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !user) return;
    setSaving(true);

    const coverIdx = Math.floor(Math.random() * COVER_IMAGES.length);

    if (editingProject) {
      await supabase
        .from('projects')
        .update({ ...form, updated_at: new Date().toISOString() })
        .eq('id', editingProject.id);
      setProjects((prev) => prev.map((p) => p.id === editingProject.id ? { ...p, ...form } : p));
    } else {
      const { data } = await supabase
        .from('projects')
        .insert({ user_id: user.id, ...form, cover_url: COVER_IMAGES[coverIdx] })
        .select()
        .maybeSingle();
      if (data) setProjects([{ ...data, videoCount: 0 }, ...projects]);
    }

    setSaving(false);
    setShowCreate(false);
  };

  const deleteProject = async (id: string) => {
    await supabase.from('projects').delete().eq('id', id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  const togglePublic = async (project: ProjectWithCount) => {
    await supabase
      .from('projects')
      .update({ is_public: !project.is_public, updated_at: new Date().toISOString() })
      .eq('id', project.id);
    setProjects((prev) => prev.map((p) => p.id === project.id ? { ...p, is_public: !p.is_public } : p));
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="text-gray-400 text-sm mt-0.5">Organize your videos into collections</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-white text-sm font-medium rounded-xl transition-all"
        >
          <Plus size={16} />
          New Project
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={28} className="animate-spin text-cyan-400" />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-24">
          <FolderOpen size={40} className="text-gray-700 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-400 mb-2">No projects yet</h3>
          <p className="text-gray-600 text-sm mb-6">Create a project to organize your generated videos</p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-white text-sm font-medium rounded-xl transition-all"
          >
            <Plus size={15} />
            Create Your First Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((project) => (
            <div
              key={project.id}
              className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-700 transition-all duration-200"
            >
              <div className="relative aspect-video bg-gray-800">
                <img
                  src={project.cover_url || COVER_IMAGES[0]}
                  alt={project.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                <div className="absolute top-3 right-3">
                  <div className="relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === project.id ? null : project.id); setConfirmDeleteId(null); }}
                      className="w-8 h-8 bg-black/50 backdrop-blur-sm rounded-lg flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                    {openMenuId === project.id && (
                      <>
                        {/* Backdrop to close menu */}
                        <div className="fixed inset-0 z-10" onClick={() => { setOpenMenuId(null); setConfirmDeleteId(null); }} />
                        <div className="absolute right-0 top-full mt-1 w-44 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-20 overflow-hidden">
                          <button
                            onClick={() => { openEdit(project); setOpenMenuId(null); }}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                          >
                            <Edit2 size={12} /> 编辑
                          </button>
                          <button
                            onClick={() => { togglePublic(project); setOpenMenuId(null); }}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                          >
                            {project.is_public ? <Lock size={12} /> : <Globe size={12} />}
                            {project.is_public ? '设为私有' : '公开'}
                          </button>
                          <div className="border-t border-gray-700/60" />
                          {confirmDeleteId === project.id ? (
                            <div className="px-3 py-2.5">
                              <p className="text-xs text-gray-300 mb-2">确认删除此项目？</p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => { deleteProject(project.id); setOpenMenuId(null); setConfirmDeleteId(null); }}
                                  className="flex-1 py-1.5 bg-red-500 hover:bg-red-400 text-white text-xs rounded-lg transition-colors font-medium"
                                >
                                  删除
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg transition-colors"
                                >
                                  取消
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(project.id)}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 size={12} /> 删除
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="absolute bottom-3 left-3 flex items-center gap-2">
                  {project.is_public ? (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs">
                      <Globe size={9} /> Public
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-800/80 border border-gray-700 text-gray-400 text-xs">
                      <Lock size={9} /> Private
                    </span>
                  )}
                </div>
              </div>

              <div className="p-4">
                <h3 className="font-semibold text-white mb-1">{project.name}</h3>
                {project.description && (
                  <p className="text-sm text-gray-400 mb-3 line-clamp-2">{project.description}</p>
                )}
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Film size={12} />
                  <span>{project.videoCount} video{project.videoCount !== 1 ? 's' : ''}</span>
                  <span className="text-gray-700">·</span>
                  <span>{new Date(project.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-white">
                {editingProject ? 'Edit Project' : 'New Project'}
              </h3>
              <button onClick={() => setShowCreate(false)} className="p-1.5 text-gray-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Project Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Sci-Fi Series"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Description (optional)</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What is this project about?"
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors resize-none"
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setForm({ ...form, is_public: !form.is_public })}
                  className={`w-10 h-5.5 rounded-full transition-all flex items-center px-0.5 ${form.is_public ? 'bg-cyan-500' : 'bg-gray-700'}`}
                  style={{ height: '22px' }}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-all ${form.is_public ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
                <span className="text-sm text-gray-300">Make project public</span>
              </label>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSave}
                disabled={!form.name.trim() || saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-white font-medium text-sm rounded-xl transition-colors"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {editingProject ? 'Save Changes' : 'Create Project'}
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
