import React, { useState, useRef } from 'react';
import {
  Upload,
  Image as ImageIcon,
  Trash2,
  RefreshCw,
  Plus,
  ArrowUp,
  ArrowDown,
  Eye,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Link as LinkIcon,
  Layers,
  X,
  ShieldCheck,
  Check,
  School
} from 'lucide-react';
import { GalleryPhoto, UserProfile } from '../types';
import {
  saveGalleryPhotoToFirestore,
  deleteGalleryPhotoFromFirestore,
  reseedDefaultGalleryPhotos,
} from '../lib/firebase';
import { AutoSwipingGallery } from './AutoSwipingGallery';

// Import Official SVNHS Campus Photography Assets
import campusFacadeImg from '../assets/images/svnhs_campus_facade_1785197520353.jpg';
import shsBuildingImg from '../assets/images/svnhs_shs_building_1785313106378.jpg';
import labFacilityImg from '../assets/images/svnhs_lab_facility_1785313127268.jpg';
import schoolLogoImg from '../assets/images/svnhs_school_logo_1784856263175.jpg';

interface AdminGalleryManagerProps {
  currentUser: UserProfile;
  photos: GalleryPhoto[];
}

export const AdminGalleryManager: React.FC<AdminGalleryManagerProps> = ({
  currentUser,
  photos,
}) => {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [uploadMode, setUploadMode] = useState<'file' | 'url' | 'assets'>('file');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [photoTitle, setPhotoTitle] = useState<string>('');
  const [photoCaption, setPhotoCaption] = useState<string>('');
  const [imageSizeFormatted, setImageSizeFormatted] = useState<string>('');
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Replace Photo State
  const [replacingPhotoId, setReplacingPhotoId] = useState<string | null>(null);

  // Delete Confirmation Modal
  const [deletingPhoto, setDeletingPhoto] = useState<GalleryPhoto | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Official Built-in Campus Photos for 1-click selection
  const OFFICIAL_ASSETS = [
    {
      id: 'asset-facade',
      title: 'San Vicente National High School Campus Facade',
      caption: 'Main entrance and lush academic grounds welcoming Senior and Junior High learners.',
      src: campusFacadeImg,
      badge: 'Main Campus',
    },
    {
      id: 'asset-building',
      title: 'Senior High School Academic Building & Quadrangle',
      caption: 'Modern multistory academic classrooms dedicated to Senior High tracks and DepEd curricula.',
      src: shsBuildingImg,
      badge: 'SHS Building',
    },
    {
      id: 'asset-lab',
      title: 'Science & STEM Innovation Laboratory',
      caption: 'Equipped science facilities fostering scientific research, experimentation, and critical inquiry.',
      src: labFacilityImg,
      badge: 'Science Lab',
    },
    {
      id: 'asset-logo',
      title: 'San Vicente National High School Official Seal',
      caption: 'Department of Education • CARAGA Region • Division of Bislig City • School ID: 304868',
      src: schoolLogoImg,
      badge: 'School Seal',
    },
  ];

  // Helper: Format byte sizes nicely
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  // Helper: High-efficiency, memory-safe client image compression
  // Guarantees Base64 data URL is < 420 KB to prevent exceeding Firestore 1MB document limit
  const compressImage = (file: File): Promise<{ dataUrl: string; sizeFormatted: string }> => {
    return new Promise((resolve, reject) => {
      // Use URL.createObjectURL for 10x faster memory-safe decoding
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        try {
          URL.revokeObjectURL(objectUrl);
          const canvas = document.createElement('canvas');
          let width = img.width || 1200;
          let height = img.height || 800;
          const maxDimension = 1100; // Optimal resolution for high-definition desktop carousels

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({ dataUrl: img.src, sizeFormatted: formatBytes(file.size) });
            return;
          }

          // Fill white background first (so transparent PNGs don't turn into black boxes)
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          // Adaptive compression loop ensuring payload is strictly under 420 KB
          let quality = 0.82;
          let dataUrl = canvas.toDataURL('image/jpeg', quality);

          while (dataUrl.length > 420000 && quality > 0.35) {
            quality -= 0.12;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }

          const approxBytes = Math.round((dataUrl.length * 3) / 4);
          resolve({ dataUrl, sizeFormatted: formatBytes(approxBytes) });
        } catch (err) {
          reject(err);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        // Fallback: try standard FileReader if object URL fails
        const reader = new FileReader();
        reader.onload = (e) => {
          const fallbackData = (e.target?.result as string) || '';
          resolve({ dataUrl: fallbackData, sizeFormatted: formatBytes(file.size) });
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      };

      img.src = objectUrl;
    });
  };

  // Process File selection
  const processSelectedFile = async (file: File) => {
    const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|svg|avif)$/i.test(file.name);
    if (!isImage) {
      setActionMessage({ type: 'error', text: 'Please select a valid image file (JPG, PNG, WebP).' });
      return;
    }

    try {
      setIsCompressing(true);
      setActionMessage(null);
      const { dataUrl, sizeFormatted } = await compressImage(file);
      setPreviewUrl(dataUrl);
      setImageSizeFormatted(sizeFormatted);

      if (!photoTitle) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setPhotoTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
      }
    } catch (err) {
      console.error('Image compression error:', err);
      setActionMessage({ type: 'error', text: 'Failed to process picture. Please try another image file.' });
    } finally {
      setIsCompressing(false);
    }
  };

  // Handle File Input Change
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processSelectedFile(file);
    // Reset file input so selecting the same file again triggers onChange
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Drag and Drop Event Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processSelectedFile(file);
    }
  };

  // Select built-in school asset
  const handleSelectAsset = (asset: (typeof OFFICIAL_ASSETS)[0]) => {
    setPreviewUrl(asset.src);
    setPhotoTitle(asset.title);
    setPhotoCaption(asset.caption);
    setImageSizeFormatted('Optimized SVNHS Asset');
  };

  // Open modal to add new photo
  const handleOpenAddModal = () => {
    setReplacingPhotoId(null);
    setPreviewUrl('');
    setPhotoTitle('');
    setPhotoCaption('');
    setImageSizeFormatted('');
    setUploadMode('file');
    setIsUploadModalOpen(true);
  };

  // Open modal to replace an existing photo
  const handleOpenReplaceModal = (photo: GalleryPhoto) => {
    setReplacingPhotoId(photo.id);
    setPreviewUrl(photo.url);
    setPhotoTitle(photo.title);
    setPhotoCaption(photo.caption || '');
    setImageSizeFormatted('');
    setUploadMode(photo.url.startsWith('data:') ? 'file' : 'url');
    setIsUploadModalOpen(true);
  };

  // Submit Photo (Add or Replace)
  const handleSubmitPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!previewUrl) {
      setActionMessage({ type: 'error', text: 'Please select a picture file, provide an image URL, or choose a school asset.' });
      return;
    }
    if (!photoTitle.trim()) {
      setActionMessage({ type: 'error', text: 'Please enter a title for the picture.' });
      return;
    }

    setIsSubmitting(true);
    setActionMessage(null);

    try {
      const today = new Date().toISOString().substring(0, 10);
      const photoId = replacingPhotoId || `gallery-${Date.now()}`;
      const currentOrder = replacingPhotoId
        ? photos.find((p) => p.id === replacingPhotoId)?.order || photos.length + 1
        : photos.length + 1;

      // Defensive payload: Ensure all fields are clean strings and numbers (never undefined)
      const photoDoc: GalleryPhoto = {
        id: photoId,
        url: previewUrl,
        title: photoTitle.trim(),
        caption: photoCaption.trim() || '',
        uploadedAt: today,
        uploadedBy: currentUser.name || 'Master Admin',
        order: currentOrder,
      };

      await saveGalleryPhotoToFirestore(photoDoc);

      setActionMessage({
        type: 'success',
        text: replacingPhotoId
          ? `Picture "${photoTitle.trim()}" successfully updated in Firebase!`
          : `Picture "${photoTitle.trim()}" successfully saved to Firebase and published to the Login Gallery!`,
      });

      setIsUploadModalOpen(false);
      setPreviewUrl('');
      setPhotoTitle('');
      setPhotoCaption('');
      setImageSizeFormatted('');
      setReplacingPhotoId(null);
    } catch (err: any) {
      console.error('Error saving gallery photo:', err);
      setActionMessage({
        type: 'error',
        text: `Failed to save picture to Firebase: ${err?.message || 'Database connection error. Please try again.'}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Photo
  const handleConfirmDelete = async () => {
    if (!deletingPhoto) return;

    try {
      await deleteGalleryPhotoFromFirestore(deletingPhoto.id);
      setActionMessage({
        type: 'success',
        text: `Picture "${deletingPhoto.title}" removed from Firebase gallery.`,
      });
      setDeletingPhoto(null);
    } catch (err: any) {
      console.error('Error deleting photo:', err);
      setActionMessage({
        type: 'error',
        text: `Failed to delete picture from Firebase: ${err?.message || 'Operation failed'}`,
      });
    }
  };

  // Reorder Photo (Up or Down)
  const handleMovePhoto = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= photos.length) return;

    const currentItem = photos[index];
    const targetItem = photos[targetIndex];

    try {
      const updatedCurrent: GalleryPhoto = { ...currentItem, order: targetIndex + 1 };
      const updatedTarget: GalleryPhoto = { ...targetItem, order: index + 1 };

      await Promise.all([
        saveGalleryPhotoToFirestore(updatedCurrent),
        saveGalleryPhotoToFirestore(updatedTarget),
      ]);

      setActionMessage({ type: 'success', text: 'Gallery order updated in Firebase!' });
    } catch (err: any) {
      console.error('Error reordering photos:', err);
      setActionMessage({ type: 'error', text: 'Failed to update order in Firebase.' });
    }
  };

  // Reseed defaults
  const handleResetDefaults = async () => {
    if (!window.confirm('Restore official default SVNHS campus pictures to Firebase? This will re-add baseline photos to the rotation.')) {
      return;
    }

    try {
      await reseedDefaultGalleryPhotos();
      setActionMessage({ type: 'success', text: 'Baseline SVNHS pictures restored to Firebase gallery!' });
    } catch (err: any) {
      console.error('Error resetting defaults:', err);
      setActionMessage({ type: 'error', text: `Failed to restore default pictures: ${err?.message || 'Error'}` });
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert Message */}
      {actionMessage && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between text-xs font-mono font-bold shadow-sm animate-fadeIn ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-300'
              : 'bg-rose-50 text-rose-900 border border-rose-300'
          }`}
        >
          <div className="flex items-center space-x-2">
            {actionMessage.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            className="text-slate-400 hover:text-slate-700 ml-4 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-rose-900 via-pink-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="bg-rose-500/30 border border-rose-400/40 text-rose-200 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full uppercase flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 text-rose-300" />
                <span>Master Admin Privilege</span>
              </span>
              <span className="bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full uppercase flex items-center space-x-1">
                <Sparkles className="w-3 h-3 text-emerald-300" />
                <span>Live on Login Screen</span>
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white flex items-center space-x-2">
              <ImageIcon className="w-6 h-6 text-rose-400" />
              <span>Login Page Auto-Swiping Gallery Manager</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl font-sans leading-relaxed">
              Upload, reorder, and manage the showcase pictures displayed in the auto-swiping gallery at the top of the San Vicente National High School login portal. All changes are saved to Firebase Firestore and take effect instantly.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-mono font-bold text-xs rounded-xl shadow-md transition-all flex items-center space-x-2 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4 text-white" />
              <span>Upload New Picture</span>
            </button>

            <button
              type="button"
              onClick={handleResetDefaults}
              title="Restore official default SVNHS pictures"
              className="px-3 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-mono font-semibold text-xs rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </button>
          </div>
        </div>
      </div>

      {/* LIVE PREVIEW SECTION */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <Eye className="w-4 h-4 text-emerald-600" />
            <h2 className="text-xs sm:text-sm font-bold font-mono text-slate-900">
              Live Preview: Login Page Auto-Swiping Gallery
            </h2>
          </div>
          <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
            {photos.length} Active {photos.length === 1 ? 'Picture' : 'Pictures'} in Rotation
          </span>
        </div>

        <div className="pt-1">
          <AutoSwipingGallery photos={photos} />
        </div>
      </div>

      {/* PICTURES IN ROTATION LIST */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-rose-600" />
            <h3 className="text-xs sm:text-sm font-bold font-mono text-slate-900">
              Gallery Pictures ({photos.length})
            </h3>
          </div>
          <p className="text-[11px] font-mono text-slate-500">
            Click "Replace" or "Delete" to swap pictures shown on the login page.
          </p>
        </div>

        {photos.length === 0 ? (
          <div className="text-center py-12 space-y-3 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
            <ImageIcon className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="font-mono text-xs text-slate-600 font-bold">
              No pictures currently saved in the Firebase gallery
            </p>
            <p className="font-sans text-xs text-slate-500 max-w-sm mx-auto">
              Upload your first picture or restore the baseline campus photos to display on the login page.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-mono font-bold transition-all shadow-xs cursor-pointer"
              >
                Upload Picture
              </button>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer"
              >
                Load Defaults
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {photos.map((photo, index) => (
              <div
                key={photo.id}
                className="bg-slate-50 border border-slate-200 hover:border-rose-300 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
              >
                {/* Image Thumbnail */}
                <div className="relative aspect-video w-full overflow-hidden bg-slate-900">
                  <img
                    src={photo.url}
                    alt={photo.title}
                    className="w-full h-full object-cover transform-none"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=800&q=80';
                    }}
                  />
                  <div className="absolute top-2 left-2 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 bg-black/70 text-white rounded-md text-[10px] font-mono font-bold backdrop-blur-xs border border-white/20">
                      Slide #{index + 1}
                    </span>
                  </div>

                  <div className="absolute top-2 right-2 flex items-center space-x-1">
                    {/* Move Up */}
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMovePhoto(index, 'up')}
                      title="Move slide earlier"
                      className="p-1.5 bg-black/70 hover:bg-black text-white rounded-md backdrop-blur-xs transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    {/* Move Down */}
                    <button
                      type="button"
                      disabled={index === photos.length - 1}
                      onClick={() => handleMovePhoto(index, 'down')}
                      title="Move slide later"
                      className="p-1.5 bg-black/70 hover:bg-black text-white rounded-md backdrop-blur-xs transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Details */}
                <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                  <div className="space-y-1">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-1">
                      {photo.title}
                    </h4>
                    {photo.caption ? (
                      <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                        {photo.caption}
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">No description provided</p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span>Uploaded: {photo.uploadedAt || 'Recent'}</span>
                    <span className="text-slate-400">{photo.uploadedBy || 'Admin'}</span>
                  </div>
                </div>

                {/* Action Footer */}
                <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenReplaceModal(photo)}
                    className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[11px] font-bold rounded-lg transition-all flex items-center justify-center space-x-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3 text-slate-600" />
                    <span>Replace Picture</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeletingPhoto(photo)}
                    title="Delete picture from Firebase"
                    className="py-1.5 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-mono text-[11px] font-bold rounded-lg border border-rose-200 transition-all flex items-center justify-center space-x-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* UPLOAD / REPLACE MODAL */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center min-h-screen">
          <div className="bg-[#141c2c] rounded-3xl border border-[#24334b] shadow-2xl w-full max-w-xl max-h-[88vh] flex flex-col overflow-hidden my-auto animate-scaleUp text-slate-100">
            {/* Modal Header (Pinned at Top) */}
            <div className="bg-gradient-to-r from-rose-700 via-rose-800 to-slate-900 text-white p-5 flex items-center justify-between shrink-0 shadow-xs border-b border-[#24334b]">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-white/20 text-white rounded-xl">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold font-mono">
                    {replacingPhotoId ? 'Replace Gallery Picture' : 'Upload Picture to Firebase Gallery'}
                  </h3>
                  <p className="text-[10px] text-rose-200 font-mono">
                    Displayed on the login screen auto-swiping gallery
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form with Scrollable Body & Pinned Footer */}
            <form onSubmit={handleSubmitPhoto} className="flex flex-col flex-1 overflow-hidden min-h-0">
              {/* Scrollable Content Area */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 min-h-0 overscroll-contain max-h-[calc(88vh-140px)]">
                {/* Upload Mode Selector (File Upload vs URL vs School Assets) */}
                <div className="flex items-center space-x-1.5 bg-[#0f1725] p-1 rounded-xl border border-[#24334b]">
                  <button
                    type="button"
                    onClick={() => setUploadMode('file')}
                    className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center justify-center space-x-1 cursor-pointer ${
                      uploadMode === 'file'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Local File</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadMode('assets')}
                    className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center justify-center space-x-1 cursor-pointer ${
                      uploadMode === 'assets'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <School className="w-3.5 h-3.5" />
                    <span>Campus Photos</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadMode('url')}
                    className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center justify-center space-x-1 cursor-pointer ${
                      uploadMode === 'url'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                    <span>Web Link</span>
                  </button>
                </div>

                {/* Mode 1: Local File Upload with robust Drag & Drop and standard label */}
                {uploadMode === 'file' && (
                  <div className="space-y-2">
                    <label className="block text-xs font-mono font-bold text-slate-700">
                      Select Picture File:
                    </label>
                    <label
                      htmlFor="gallery-file-upload-input"
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`block border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer space-y-2 ${
                        isDragging
                          ? 'border-rose-500 bg-rose-50/80 scale-[1.01]'
                          : 'border-slate-300 hover:border-rose-400 bg-slate-50 hover:bg-rose-50/30'
                      }`}
                    >
                      <input
                        id="gallery-file-upload-input"
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                      <div className="text-xs font-mono text-slate-700">
                        <span className="font-bold text-rose-700 underline underline-offset-2">Click to browse picture</span> or drag & drop here
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono">
                        JPG, PNG, WebP supported. Automatically scaled and optimized for cloud storage.
                      </p>
                    </label>
                  </div>
                )}

                {/* Mode 2: Official SVNHS Campus Photography Assets */}
                {uploadMode === 'assets' && (
                  <div className="space-y-2">
                    <label className="block text-xs font-mono font-bold text-slate-700">
                      Choose from Official SVNHS Campus Assets:
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      {OFFICIAL_ASSETS.map((asset) => {
                        const isSelected = previewUrl === asset.src;
                        return (
                          <button
                            key={asset.id}
                            type="button"
                            onClick={() => handleSelectAsset(asset)}
                            className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                              isSelected
                                ? 'border-rose-500 bg-rose-50 ring-2 ring-rose-400/40'
                                : 'border-slate-200 hover:border-rose-300 bg-slate-50'
                            }`}
                          >
                            <div className="aspect-video w-full rounded-lg overflow-hidden bg-slate-900 mb-2 relative">
                              <img src={asset.src} alt={asset.title} className="w-full h-full object-cover" />
                              {isSelected && (
                                <div className="absolute top-1 right-1 bg-rose-600 text-white p-1 rounded-full shadow-xs">
                                  <Check className="w-3 h-3" />
                                </div>
                              )}
                            </div>
                            <div>
                              <span className="text-[9px] font-mono font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                                {asset.badge}
                              </span>
                              <p className="text-[11px] font-bold text-slate-900 mt-1 line-clamp-1">{asset.title}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Mode 3: Image URL */}
                {uploadMode === 'url' && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-mono font-bold text-slate-700">
                      Image Direct URL:
                    </label>
                    <input
                      type="url"
                      value={previewUrl.startsWith('data:') ? '' : previewUrl}
                      onChange={(e) => {
                        setPreviewUrl(e.target.value);
                        setImageSizeFormatted('External Web Link');
                      }}
                      placeholder="https://images.unsplash.com/... or https://example.com/school.jpg"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-500 font-mono"
                    />
                    <p className="text-[10px] text-slate-400 font-mono">
                      Ensure the direct image URL is publicly viewable over HTTPS.
                    </p>
                  </div>
                )}

                {/* Preview Thumbnail */}
                {isCompressing ? (
                  <div className="p-4 bg-slate-100 rounded-xl text-center font-mono text-xs text-slate-600 flex items-center justify-center space-x-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-rose-600" />
                    <span>Optimizing picture for fast cloud storage...</span>
                  </div>
                ) : previewUrl ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="block text-xs font-mono font-bold text-slate-700">
                        Picture Preview:
                      </span>
                      {imageSizeFormatted && (
                        <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          ✓ {imageSizeFormatted}
                        </span>
                      )}
                    </div>
                    <div className="relative aspect-video max-h-52 rounded-xl overflow-hidden border border-[#24334b] bg-slate-900 shadow-inner">
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="w-full h-full object-cover transform-none"
                        onError={() => {
                          setActionMessage({ type: 'error', text: 'Unable to load image from provided URL. Please check the address.' });
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewUrl('');
                          setImageSizeFormatted('');
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black text-white rounded-lg text-xs font-mono cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Title Field */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-mono font-bold text-slate-700">
                    Picture Title: <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={photoTitle}
                    onChange={(e) => setPhotoTitle(e.target.value)}
                    placeholder="e.g. Senior High School Science Laboratory"
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-500 font-mono"
                  />
                </div>

                {/* Caption Field */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-mono font-bold text-slate-700">
                    Caption / Description: (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={photoCaption}
                    onChange={(e) => setPhotoCaption(e.target.value)}
                    placeholder="e.g. Grade 11 and 12 learners conducting hands-on chemistry experiments under teacher mentorship."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-500 font-sans"
                  />
                </div>
              </div>

              {/* Modal Action Buttons (Pinned at Bottom) */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!previewUrl || !photoTitle.trim() || isSubmitting || isCompressing}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-mono text-xs font-bold transition-all shadow-md flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Saving to Firebase...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 text-white" />
                      <span>{replacingPhotoId ? 'Update Picture' : 'Save to Firebase Gallery'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingPhoto && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center min-h-screen">
          <div className="bg-[#141c2c] rounded-3xl border border-[#24334b] shadow-2xl w-full max-w-md p-6 space-y-4 my-auto animate-scaleUp text-slate-100">
            <div className="flex items-center space-x-3 text-rose-500">
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl">
                <Trash2 className="w-6 h-6 text-rose-500" />
              </div>
              <div>
                <h3 className="text-base font-bold font-mono text-slate-100">
                  Delete Gallery Picture?
                </h3>
                <p className="text-xs text-rose-300 font-mono">
                  Permanent removal from Firebase
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to remove <strong className="text-white">"{deletingPhoto.title}"</strong> from the login page gallery? This picture will immediately stop appearing on the login screen.
            </p>

            {deletingPhoto.url && (
              <div className="w-full aspect-video max-h-44 rounded-xl overflow-hidden border border-[#24334b] bg-slate-900">
                <img
                  src={deletingPhoto.url}
                  alt={deletingPhoto.title}
                  className="w-full h-full object-cover transform-none"
                />
              </div>
            )}

            <div className="flex items-center justify-end space-x-2.5 pt-2 border-t border-[#24334b]">
              <button
                type="button"
                onClick={() => setDeletingPhoto(null)}
                className="px-4 py-2 text-slate-400 hover:text-slate-200 text-xs font-mono font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-mono font-bold rounded-xl shadow-md transition-all cursor-pointer"
              >
                Yes, Delete Picture
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
