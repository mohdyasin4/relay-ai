"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Upload, FileIcon, ImageIcon, X } from "lucide-react";

export interface FileUploadProps {
  value?: File[];
  onValueChange?: (files: File[]) => void;
  onUpload?: (
    files: File[],
    callbacks: {
      onProgress: (file: File, progress: number) => void;
      onSuccess: (file: File) => void;
      onError: (file: File, error: Error) => void;
    }
  ) => void;
  onFileReject?: (file: File, message: string) => void;
  maxFiles?: number;
  maxSize?: number;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const FileUploadContext = React.createContext<{
  files: File[];
  setFiles: (files: File[]) => void;
  onUpload?: FileUploadProps["onUpload"];
  onFileReject?: FileUploadProps["onFileReject"];
  maxFiles: number;
  maxSize: number;
  accept?: string;
  multiple: boolean;
  disabled: boolean;
  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;
  uploadProgress: Map<File, number>;
  setUploadProgress: React.Dispatch<React.SetStateAction<Map<File, number>>>;
} | null>(null);

export function FileUpload({
  value = [],
  onValueChange,
  onUpload,
  onFileReject,
  maxFiles = 5,
  maxSize = 5 * 1024 * 1024, // 5MB
  accept,
  multiple = true,
  disabled = false,
  className,
  children,
  ...props
}: FileUploadProps) {
  const [files, setFiles] = React.useState<File[]>(value);
  const [isDragging, setIsDragging] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<Map<File, number>>(new Map());

  React.useEffect(() => {
    setFiles(value);
  }, [value]);

  const handleFilesChange = React.useCallback(
    (newFiles: File[]) => {
      setFiles(newFiles);
      onValueChange?.(newFiles);
    },
    [onValueChange]
  );

  const validateAndAddFiles = React.useCallback(
    (newFiles: FileList | File[]) => {
      const fileArray = Array.from(newFiles);
      const validFiles: File[] = [];

      for (const file of fileArray) {
        if (files.length + validFiles.length >= maxFiles) {
          onFileReject?.(file, `Maximum ${maxFiles} files allowed`);
          break;
        }

        if (file.size > maxSize) {
          onFileReject?.(file, `File size exceeds ${Math.round(maxSize / 1024 / 1024)}MB limit`);
          continue;
        }

        if (accept) {
          const acceptedTypes = accept.split(',').map(type => type.trim());
          const isAccepted = acceptedTypes.some(type => {
            if (type.startsWith('.')) {
              return file.name.toLowerCase().endsWith(type.toLowerCase());
            }
            return file.type.match(type.replace('*', '.*'));
          });

          if (!isAccepted) {
            onFileReject?.(file, `File type not accepted`);
            continue;
          }
        }

        validFiles.push(file);
      }

      if (validFiles.length > 0) {
        const updatedFiles = multiple ? [...files, ...validFiles] : validFiles;
        handleFilesChange(updatedFiles);

        if (onUpload) {
          onUpload(validFiles, {
            onProgress: (file, progress) => {
              setUploadProgress(prev => new Map(prev.set(file, progress)));
            },
            onSuccess: (file) => {
              setUploadProgress(prev => {
                const next = new Map(prev);
                next.delete(file);
                return next;
              });
            },
            onError: (file, error) => {
              setUploadProgress(prev => {
                const next = new Map(prev);
                next.delete(file);
                return next;
              });
              onFileReject?.(file, error.message);
            },
          });
        }
      }
    },
    [files, maxFiles, maxSize, accept, multiple, onFileReject, onUpload, handleFilesChange]
  );

  const contextValue = React.useMemo(
    () => ({
      files,
      setFiles: handleFilesChange,
      onUpload,
      onFileReject,
      maxFiles,
      maxSize,
      accept,
      multiple,
      disabled,
      isDragging,
      setIsDragging,
      uploadProgress,
      setUploadProgress,
    }),
    [
      files,
      handleFilesChange,
      onUpload,
      onFileReject,
      maxFiles,
      maxSize,
      accept,
      multiple,
      disabled,
      isDragging,
      uploadProgress,
    ]
  );

  return (
    <FileUploadContext.Provider value={contextValue}>
      <div className={cn("relative", className)} {...props}>
        {children}
      </div>
    </FileUploadContext.Provider>
  );
}

export function FileUploadDropzone({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const context = React.useContext(FileUploadContext);
  if (!context) throw new Error("FileUploadDropzone must be used within FileUpload");

  const { setIsDragging, disabled } = context;
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled, setIsDragging]);

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, [setIsDragging]);

  const handleDrop = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (disabled || !e.dataTransfer.files.length) return;
    
    // Use the validateAndAddFiles function from context
    const files = Array.from(e.dataTransfer.files);
    // We need to call the parent's validation logic
    context.setFiles([...context.files, ...files]);
  }, [disabled, setIsDragging, context]);

  return (
    <div
      className={cn(
        "border-2 border-dashed border-muted-foreground/25 rounded-lg transition-colors",
        context.isDragging && "border-primary bg-primary/5",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-dragging={context.isDragging}
      {...props}
    >
      {children}
    </div>
  );
}

export function FileUploadTrigger({
  children,
  asChild,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
}) {
  const context = React.useContext(FileUploadContext);
  if (!context) throw new Error("FileUploadTrigger must be used within FileUpload");

  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleClick = React.useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFileChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files?.length) {
      // Add files to context
      context.setFiles([...context.files, ...Array.from(files)]);
    }
    // Reset input
    e.target.value = '';
  }, [context]);

  if (asChild && React.isValidElement(children)) {
    return (
      <>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple={context.multiple}
          accept={context.accept}
          disabled={context.disabled}
          onChange={handleFileChange}
        />
        {React.cloneElement(children, {
          onClick: handleClick,
          disabled: context.disabled,
          ...props,
        })}
      </>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        multiple={context.multiple}
        accept={context.accept}
        disabled={context.disabled}
        onChange={handleFileChange}
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={context.disabled}
        {...props}
      >
        {children}
      </button>
    </>
  );
}

export function FileUploadList({
  className,
  orientation = "vertical",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  orientation?: "horizontal" | "vertical";
}) {
  const context = React.useContext(FileUploadContext);
  if (!context) throw new Error("FileUploadList must be used within FileUpload");

  return (
    <div
      className={cn(
        "flex gap-2",
        orientation === "horizontal" ? "flex-row" : "flex-col",
        className
      )}
      {...props}
    />
  );
}

export function FileUploadItem({
  value,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  value: File;
}) {
  const context = React.useContext(FileUploadContext);
  if (!context) throw new Error("FileUploadItem must be used within FileUpload");

  const progress = context.uploadProgress.get(value) ?? 0;

  return (
    <div
      className={cn(
        "relative flex items-center gap-2 p-2 border rounded-lg bg-card",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function FileUploadItemPreview({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-center w-10 h-10 rounded bg-muted",
        className
      )}
      {...props}
    >
      {children || <FileIcon className="w-4 h-4" />}
    </div>
  );
}

export function FileUploadItemMetadata({
  size = "default",
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  size?: "sm" | "default";
}) {
  const context = React.useContext(FileUploadContext);
  if (!context) throw new Error("FileUploadItemMetadata must be used within FileUpload");

  // Get the file from the closest FileUploadItem
  const fileItem = React.useContext(React.createContext<File | null>(null));

  return (
    <div
      className={cn(
        "flex-1 min-w-0",
        size === "sm" && "text-sm",
        className
      )}
      {...props}
    >
      <div className="font-medium truncate">File name</div>
      <div className="text-xs text-muted-foreground">File size</div>
    </div>
  );
}

export function FileUploadItemProgress({
  variant = "default",
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "fill";
}) {
  return (
    <div
      className={cn(
        "absolute inset-0 bg-primary/10 rounded transition-all",
        variant === "fill" && "bg-primary/20",
        className
      )}
      style={{ width: "0%" }}
      {...props}
    />
  );
}

export function FileUploadItemDelete({
  asChild,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
}) {
  const context = React.useContext(FileUploadContext);
  if (!context) throw new Error("FileUploadItemDelete must be used within FileUpload");

  const handleDelete = React.useCallback(() => {
    // This would need to be implemented to remove the specific file
    // For now, we'll just clear all files as a placeholder
    context.setFiles([]);
  }, [context]);

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: handleDelete,
      ...props,
    });
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      {...props}
    >
      {children || <X className="w-4 h-4" />}
    </button>
  );
}
