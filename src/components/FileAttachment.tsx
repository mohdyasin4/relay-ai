import { Button } from '@/components/ui/button';
import { Download, Play, Check, CheckCheck, Clock } from 'lucide-react';
import { getFileType, getFileIcon, getFileIconColor, getFileBackgroundColor, formatFileSize, canPreview } from '@/utils/fileUtils';
import { cn } from '@/lib/utils';
import { DateUtils } from '@/utils/dateUtils';

interface FileAttachmentProps {
  url: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  className?: string;
  onPreview?: () => void;
  onDownload?: () => void;
  compact?: boolean;
  onImagePreview?: (imageData: { url: string; fileName?: string; fileSize?: number }) => void;
  // Message metadata props
  messageStatus?: 'sent' | 'delivered' | 'read';
  messageTimestamp?: string | Date;
  isSelf?: boolean;
  standalone?: boolean;
}

export function FileAttachment({
  url,
  fileName,
  fileSize,
  mimeType,
  className,
  onPreview,
  onDownload,
  compact = false,
  onImagePreview,
  messageStatus,
  messageTimestamp,
  isSelf,
  standalone = false
}: FileAttachmentProps) {
  const fileType = getFileType(mimeType || '');
  const IconComponent = getFileIcon(fileType);
  const iconColor = getFileIconColor(fileType);
  const bgColor = getFileBackgroundColor(fileType);
  
  const displayName = fileName || 'Unknown file';
  const canPreviewFile = mimeType ? canPreview(mimeType) : false;

  // Render status icon for message metadata
  const renderStatusIcon = () => {
    if (!isSelf || !messageStatus) return null;
    
    if (messageStatus === 'read') {
      return <CheckCheck className="w-3 h-3 text-green-500" />;
    } else if (messageStatus === 'delivered') {
      return <CheckCheck className="w-3 h-3 text-muted-foreground" />;
    } else if (messageStatus === 'sent') {
      return <Check className="w-3 h-3 text-muted-foreground" />;
    } else {
      return <Clock className="w-3 h-3 text-muted-foreground" />;
    }
  };

  // Don't show timestamp/read receipt if this is part of a message with text
  const shouldShowMetadata = !messageTimestamp || !isSelf;

  const handlePreview = () => {
    if (canPreviewFile && onPreview) {
      onPreview();
    } else {
      // For images, use the new image preview modal
      if (fileType === 'image' && onImagePreview) {
        onImagePreview({ url, fileName, fileSize });
      }
    }
  };

  const handleDownload = async () => {
    if (onDownload) {
      onDownload();
    } else {
      try {
        // Fetch the file as blob to force download instead of navigation
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = displayName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      } catch (error) {
        console.error('Download failed:', error);
        // Fallback to simple download
        const link = document.createElement('a');
        link.href = url;
        link.download = displayName;
        link.target = '_blank';
        link.click();
      }
    }
  };

  // For images, show preview
  if (fileType === 'image' && !compact) {
    return (
      <div className={cn("relative group max-w-sm", className)}>
        <img
          src={url}
          alt={displayName}
          className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
          onClick={handlePreview}
          onError={(e) => {
            // Fallback to file icon if image fails to load
            e.currentTarget.style.display = 'none';
            e.currentTarget.nextElementSibling?.classList.remove('hidden');
          }}
        />
        
        {/* Fallback file display */}
        <div className="hidden">
          <FileAttachment
            url={url}
            fileName={displayName}
            fileSize={fileSize}
            mimeType={mimeType}
            compact={true}
          />
        </div>
        
        {/* Download button overlay on top-right corner */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation(); // Prevent triggering image preview
              handleDownload();
            }}
            className="bg-white/90 text-black hover:bg-white shadow-md"
          >
            <Download className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Combined file size, timestamp and read receipt */}
        <div className="absolute bottom-2 right-2 flex items-center gap-2">
          {/* File size */}
          {fileSize && (
            <div className="bg-black/70 text-white text-xs px-2 py-1 rounded">
              {formatFileSize(fileSize)}
            </div>
          )}
          
          {/* Timestamp and read receipt - only show for standalone attachments */}
          {shouldShowMetadata && messageTimestamp && (
            <div className="flex items-center gap-2 text-[11px] text-white bg-black/70 px-2 py-1 rounded">
              <span
                title={DateUtils.formatFullDateTime(messageTimestamp)}
              >
                {DateUtils.formatMessageTime(messageTimestamp, true)}
              </span>
              {renderStatusIcon()}
            </div>
          )}
        </div>
      </div>
    );
  }

  // For other file types or compact mode
  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg transition-colors group",
      standalone ? "bg-transparent border-0" : "border bg-card",
      compact && "p-2 gap-2",
      className
    )}>
      {/* File icon */}
      <div className={cn(
        "flex items-center justify-center rounded-lg flex-shrink-0",
        bgColor,
        compact ? "w-8 h-8" : "w-12 h-12"
      )}>
        <IconComponent className={cn(
          iconColor,
          compact ? "w-4 h-4" : "w-6 h-6"
        )} />
      </div>
      
      {/* File info */}
      <div className="flex-1 min-w-0">
        <div className={cn(
          "font-medium truncate",
          compact ? "text-sm" : "text-base"
        )}>
          {displayName}
        </div>
        {fileSize && (
          <div className={cn(
            "text-muted-foreground",
            compact ? "text-xs" : "text-sm"
          )}>
            {formatFileSize(fileSize)}
          </div>
        )}
      </div>
      
      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {fileType === 'audio' && (
          <Button
            variant="ghost"
            size={compact ? "sm" : "default"}
            onClick={handlePreview}
            className="h-8 w-8 p-0"
          >
            <Play className="w-4 h-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size={compact ? "sm" : "default"}
          onClick={handleDownload}
          className="h-8 w-8 p-0"
        >
          <Download className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
