import React, { useState } from 'react';
import {
  Video,
  Plus,
  Trash2,
  Edit3,
  ArrowUp,
  ArrowDown,
  Eye,
  CheckCircle,
  AlertCircle,
  Code,
  Sparkles,
  X,
  Play,
  Layers,
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import { EmbeddedVideo, UserProfile } from '../types';
import {
  saveEmbeddedVideoToFirestore,
  deleteEmbeddedVideoFromFirestore,
} from '../lib/firebase';
import { formatEmbedCode } from './ScrollableVideoSection';
import { FineTunedVideoPlayer } from './FineTunedVideoPlayer';

interface AdminVideoManagerProps {
  currentUser: UserProfile;
  videos: EmbeddedVideo[];
  onSwitchToGallery?: () => void;
}

export const AdminVideoManager: React.FC<AdminVideoManagerProps> = ({
  currentUser,
  videos,
  onSwitchToGallery,
}) => {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingVideo, setEditingVideo] = useState<EmbeddedVideo | null>(null);
  const [title, setTitle] = useState<string>('');
  const [embedCode, setEmbedCode] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deletingVideo, setDeletingVideo] = useState<EmbeddedVideo | null>(null);
  const [previewingVideo, setPreviewingVideo] = useState<EmbeddedVideo | null>(null);

  const openAddModal = () => {
    setEditingVideo(null);
    setTitle('');
    setEmbedCode('');
    setDescription('');
    setStatusMessage(null);
    setIsModalOpen(true);
  };

  const openEditModal = (video: EmbeddedVideo) => {
    setEditingVideo(video);
    setTitle(video.title || '');
    setEmbedCode(video.embedCode || '');
    setDescription(video.description || '');
    setStatusMessage(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter a title for the video.' });
      return;
    }
    if (!embedCode.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter HTML or iframe code for the video.' });
      return;
    }

    try {
      setIsSubmitting(true);
      setStatusMessage(null);

      const videoData: EmbeddedVideo = {
        id: editingVideo?.id || `video-${Date.now()}`,
        title: title.trim(),
        embedCode: embedCode.trim(),
        description: description.trim(),
        createdAt: editingVideo?.createdAt || new Date().toISOString().substring(0, 10),
        createdBy: currentUser.name || 'Master Admin',
        order: editingVideo?.order ?? (videos.length + 1),
      };

      await saveEmbeddedVideoToFirestore(videoData);
      setStatusMessage({
        type: 'success',
        text: editingVideo ? 'Video embed updated successfully!' : 'New video embed added successfully!',
      });

      setTimeout(() => {
        setIsModalOpen(false);
        setEditingVideo(null);
        setTitle('');
        setEmbedCode('');
        setDescription('');
      }, 1000);
    } catch (err: any) {
      console.error('Error saving embedded video:', err);
      setStatusMessage({ type: 'error', text: err?.message || 'Failed to save embedded video.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingVideo) return;
    try {
      setIsSubmitting(true);
      await deleteEmbeddedVideoFromFirestore(deletingVideo.id);
      setDeletingVideo(null);
    } catch (err) {
      console.error('Error deleting video:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMoveOrder = async (video: EmbeddedVideo, direction: 'up' | 'down') => {
    const sorted = [...videos].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const currentIndex = sorted.findIndex((v) => v.id === video.id);
    if (currentIndex < 0) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    const otherVideo = sorted[targetIndex];
    const currentOrder = video.order ?? currentIndex + 1;
    const otherOrder = otherVideo.order ?? targetIndex + 1;

    // Swap orders
    await saveEmbeddedVideoToFirestore({ ...video, order: otherOrder });
    await saveEmbeddedVideoToFirestore({ ...otherVideo, order: currentOrder });
  };

  // Helper sample templates for Master Admin
  const insertTemplate = (type: 'youtube' | 'drive' | 'html5') => {
    if (type === 'youtube') {
      setTitle((prev) => prev || 'San Vicente National High School Campus Showcase');
      setEmbedCode(
        `<iframe width="560" height="315" src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&mute=1&enablejsapi=1&playsinline=1" title="San Vicente NHS Video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`
      );
      setDescription(
        (prev) => prev || 'Official school video presentation highlighting Senior High School programs and activities.'
      );
    } else if (type === 'drive') {
      setTitle((prev) => prev || 'DepEd Bislig City Instructional Presentation');
      setEmbedCode(
        `<iframe src="https://drive.google.com/file/d/1a2b3c4d5e6f/preview" width="640" height="480" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
      );
      setDescription(
        (prev) => prev || 'Instructional curriculum and departmental video orientation.'
      );
    } else {
      setTitle((prev) => prev || 'Classroom Teaching & Learning Showcase');
      setEmbedCode(
        `<video controls autoPlay muted playsinline webkit-playsinline="true" preload="auto" style="object-fit: contain;" class="w-full h-full object-contain"><source src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" type="video/mp4"></video>`
      );
      setDescription((prev) => prev || 'Sample educational demonstration video.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#141c2c] border border-[#24334b] rounded-3xl p-6 sm:p-8 shadow-xl text-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-2xl">
              <Video className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="bg-purple-900/60 text-purple-300 border border-purple-500/30 text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase">
                  Master Admin Exclusive
                </span>
                <span className="text-slate-400 text-xs font-mono">
                  Login View Media
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
                Login Page Embedded Videos
              </h2>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 font-sans max-w-2xl leading-relaxed">
            Manage the scrollable embedded videos displayed on the public Login View below the Introduction & Principal's Message. 
            Only the HTML or iframe code provided by the Master Admin will appear on the portal.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {onSwitchToGallery && (
            <button
              type="button"
              onClick={onSwitchToGallery}
              className="px-4 py-2.5 bg-[#1b263b] hover:bg-[#24334b] text-slate-200 border border-[#2b3c58] rounded-xl font-mono text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer"
            >
              <Layers className="w-4 h-4 text-rose-400" />
              <span>Manage Gallery Photos</span>
            </button>
          )}

          <button
            type="button"
            onClick={openAddModal}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-mono text-xs font-bold shadow-lg shadow-purple-900/40 border border-purple-400 transition-all flex items-center space-x-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Embedded Video</span>
          </button>
        </div>
      </div>

      {/* Videos List Grid */}
      {videos && videos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {videos.map((video, index) => {
            const formatted = formatEmbedCode(video.embedCode);
            return (
              <div
                key={video.id}
                className="bg-[#141c2c] border border-[#24334b] rounded-2xl overflow-hidden shadow-lg flex flex-col justify-between transition-all hover:border-purple-500/50"
              >
                {/* Embed Video Interactive Player Box */}
                <div className="relative w-full aspect-video bg-black overflow-hidden border-b border-[#24334b] flex items-center justify-center">
                  <FineTunedVideoPlayer
                    embedCode={video.embedCode}
                    title={video.title}
                  />
                  <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-xs text-purple-300 border border-purple-400/40 text-[10px] font-mono font-bold px-2 py-0.5 rounded pointer-events-none z-10">
                    #{video.order ?? index + 1}
                  </div>
                </div>

                {/* Video Info */}
                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-bold text-white line-clamp-1">
                      {video.title}
                    </h3>
                    {video.description ? (
                      <p className="text-xs text-slate-300 font-sans line-clamp-2">
                        {video.description}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 italic font-sans">
                        No description provided.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 pt-2 border-t border-[#24334b]/80">
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>Added: {video.createdAt || 'N/A'}</span>
                      <span className="text-purple-300 font-semibold">{video.createdBy || 'Master Admin'}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between gap-1 pt-1">
                      {/* Reorder Buttons */}
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => handleMoveOrder(video, 'up')}
                          disabled={index === 0}
                          title="Move earlier in scroll sequence"
                          className="p-1.5 bg-[#1b263b] hover:bg-[#24334b] text-slate-300 rounded-lg disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveOrder(video, 'down')}
                          disabled={index === videos.length - 1}
                          title="Move later in scroll sequence"
                          className="p-1.5 bg-[#1b263b] hover:bg-[#24334b] text-slate-300 rounded-lg disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Edit & Delete */}
                      <div className="flex items-center space-x-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(video)}
                          className="p-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white rounded-lg transition-colors cursor-pointer border border-blue-500/30"
                          title="Edit Video Code"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingVideo(video)}
                          className="p-1.5 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white rounded-lg transition-colors cursor-pointer border border-rose-500/30"
                          title="Delete Video"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="bg-[#141c2c] border-2 border-dashed border-[#24334b] rounded-3xl p-10 text-center space-y-4 text-slate-300">
          <div className="w-16 h-16 rounded-3xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center mx-auto">
            <Video className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-white">
              No Embedded Videos Added Yet
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Only the code provided by the Master Admin will be shown in the Login View's scrollable videos section.
              Click the button below to paste your first HTML or iframe video code.
            </p>
          </div>
          <button
            type="button"
            onClick={openAddModal}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-mono text-xs font-bold transition-all inline-flex items-center space-x-2 cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Add First Embedded Video</span>
          </button>
        </div>
      )}

      {/* MODAL: ADD / EDIT VIDEO EMBED */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center animate-fadeIn">
          <div className="bg-[#141c2c] border border-[#24334b] rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl text-slate-100 space-y-5 my-8 animate-scaleUp">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#24334b] pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-xl">
                  <Code className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    {editingVideo ? 'Edit Embedded Video Code' : 'Provide New Embedded Video Code'}
                  </h3>
                  <p className="text-xs text-slate-400 font-sans">
                    Master Admin HTML / iframe code input for Login View
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 hover:bg-[#1b263b] text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Templates Bar */}
            <div className="bg-[#0f172a] p-3 rounded-2xl border border-[#24334b] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold text-purple-300 flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Quick Insert Sample Code / Templates:</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">Click to autofill</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => insertTemplate('youtube')}
                  className="px-2.5 py-1 bg-[#1b263b] hover:bg-purple-900/60 text-slate-200 hover:text-purple-200 text-xs font-mono rounded-lg border border-[#2b3c58] transition-all cursor-pointer"
                >
                  YouTube Iframe
                </button>
                <button
                  type="button"
                  onClick={() => insertTemplate('drive')}
                  className="px-2.5 py-1 bg-[#1b263b] hover:bg-purple-900/60 text-slate-200 hover:text-purple-200 text-xs font-mono rounded-lg border border-[#2b3c58] transition-all cursor-pointer"
                >
                  Google Drive Iframe
                </button>
                <button
                  type="button"
                  onClick={() => insertTemplate('html5')}
                  className="px-2.5 py-1 bg-[#1b263b] hover:bg-purple-900/60 text-slate-200 hover:text-purple-200 text-xs font-mono rounded-lg border border-[#2b3c58] transition-all cursor-pointer"
                >
                  HTML5 Video Tag
                </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="space-y-4">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold text-slate-300">
                  Video Title <span className="text-purple-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., San Vicente NHS Senior High School Campus Showcase"
                  required
                  className="w-full px-3.5 py-2.5 bg-[#0f172a] border border-[#24334b] focus:border-purple-500 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-hidden"
                />
              </div>

              {/* Embed Code Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono font-bold text-slate-300 flex items-center space-x-1.5">
                    <span>HTML Code or Iframe Code</span>
                    <span className="text-purple-400">*</span>
                  </label>
                  <span className="text-[10px] font-mono text-slate-400">
                    Supports &lt;iframe&gt;, &lt;video&gt;, or direct embed URLs
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={embedCode}
                  onChange={(e) => setEmbedCode(e.target.value)}
                  placeholder={`<iframe width="560" height="315" src="https://www.youtube.com/embed/..." title="YouTube video player" frameborder="0" allow="..." allowfullscreen></iframe>`}
                  required
                  className="w-full px-3.5 py-2.5 bg-[#0f172a] border border-[#24334b] focus:border-purple-500 rounded-xl text-xs font-mono text-purple-200 placeholder-slate-600 focus:outline-hidden"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold text-slate-300">
                  Description / Caption (Optional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief summary or context for learners and faculty"
                  className="w-full px-3.5 py-2.5 bg-[#0f172a] border border-[#24334b] focus:border-purple-500 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-hidden"
                />
              </div>

              {/* Real-time Code Preview */}
              {embedCode.trim() && (
                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-bold text-emerald-400 flex items-center space-x-1.5">
                    <Eye className="w-3.5 h-3.5" />
                    <span>Real-Time Embed Preview (Test Play & Pause)</span>
                  </label>
                  <FineTunedVideoPlayer
                    embedCode={embedCode}
                    title={title || 'Preview Video'}
                  />
                </div>
              )}

              {/* Status Message */}
              {statusMessage && (
                <div
                  className={`p-3 rounded-xl text-xs font-mono flex items-center space-x-2 ${
                    statusMessage.type === 'success'
                      ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/50'
                      : 'bg-rose-950/60 text-rose-300 border border-rose-500/50'
                  }`}
                >
                  {statusMessage.type === 'success' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span>{statusMessage.text}</span>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#24334b]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-[#1b263b] hover:bg-[#24334b] text-slate-300 text-xs font-mono font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-mono font-bold rounded-xl transition-all shadow-md shadow-purple-900/40 border border-purple-400 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Saving to Firestore...' : editingVideo ? 'Save Changes' : 'Save Video Embed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PREVIEW VIDEO MODAL */}
      {previewingVideo && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center animate-fadeIn">
          <div className="bg-[#141c2c] border border-[#24334b] rounded-3xl max-w-3xl w-full p-6 shadow-2xl text-white space-y-4">
            <div className="flex items-center justify-between border-b border-[#24334b] pb-3">
              <div className="flex items-center space-x-2">
                <Video className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">
                  {previewingVideo.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewingVideo(null)}
                className="p-1.5 hover:bg-[#1b263b] text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <FineTunedVideoPlayer
              embedCode={previewingVideo.embedCode}
              title={previewingVideo.title}
            />
            {previewingVideo.description && (
              <p className="text-xs text-slate-300 font-sans">
                {previewingVideo.description}
              </p>
            )}
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingVideo && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center animate-fadeIn">
          <div className="bg-[#141c2c] border border-rose-500/50 rounded-3xl max-w-md w-full p-6 shadow-2xl text-white space-y-4 animate-scaleUp">
            <div className="flex items-center space-x-3 text-rose-400">
              <div className="p-3 bg-rose-500/20 rounded-2xl border border-rose-500/30">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Delete Video Embed?</h4>
                <p className="text-xs text-slate-400 font-sans">
                  This will remove the video from the Login View.
                </p>
              </div>
            </div>

            <div className="p-3 bg-[#0f172a] rounded-xl border border-[#24334b] text-xs font-mono text-slate-300 space-y-1">
              <p className="font-bold text-white">{deletingVideo.title}</p>
              <p className="text-[10px] text-slate-400 truncate">{deletingVideo.embedCode}</p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingVideo(null)}
                className="px-4 py-2 bg-[#1b263b] hover:bg-[#24334b] text-slate-300 text-xs font-mono font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold rounded-xl transition-all cursor-pointer shadow-md"
              >
                {isSubmitting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
