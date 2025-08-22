import { FileIcon, FileImageIcon, FileVideoIcon, FileAudioIcon, FileTextIcon } from "lucide-react";

export function getFileType(file: File | string): 'image' | 'document' | 'audio' | 'video' {
  const mimeType = typeof file === 'string' ? file : file.type;
  
  if (mimeType.startsWith('image/')) {
    return 'image';
  } else if (mimeType.startsWith('video/')) {
    return 'video';
  } else if (mimeType.startsWith('audio/')) {
    return 'audio';
  } else {
    return 'document';
  }
}

export function getFileIcon(fileType: 'image' | 'document' | 'audio' | 'video', className?: string) {
  switch (fileType) {
    case 'image':
      return FileImageIcon;
    case 'video':
      return FileVideoIcon;
    case 'audio':
      return FileAudioIcon;
    case 'document':
    default:
      return FileTextIcon;
  }
}

export function getFileIconColor(fileType: 'image' | 'document' | 'audio' | 'video'): string {
  switch (fileType) {
    case 'image':
      return 'text-blue-600 dark:text-blue-400';
    case 'video':
      return 'text-purple-600 dark:text-purple-400';
    case 'audio':
      return 'text-green-600 dark:text-green-400';
    case 'document':
    default:
      return 'text-slate-600 dark:text-slate-400';
  }
}

export function getFileBackgroundColor(fileType: 'image' | 'document' | 'audio' | 'video'): string {
  switch (fileType) {
    case 'image':
      return 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-800/50';
    case 'video':
      return 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200/50 dark:border-purple-800/50';
    case 'audio':
      return 'bg-green-50 dark:bg-green-900/20 border border-green-200/50 dark:border-green-800/50';
    case 'document':
    default:
      return 'bg-slate-50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50';
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export function isVideoFile(mimeType: string): boolean {
  return mimeType.startsWith('video/');
}

export function isAudioFile(mimeType: string): boolean {
  return mimeType.startsWith('audio/');
}

export function isPDFFile(mimeType: string): boolean {
  return mimeType === 'application/pdf';
}

export function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

export function canPreview(mimeType: string): boolean {
  return isImageFile(mimeType) || isPDFFile(mimeType);
}

