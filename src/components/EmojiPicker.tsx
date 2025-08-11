import React, { useEffect, useRef } from "react";
import Picker from "emoji-picker-react";

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
}

const EmojiPicker: React.FC<EmojiPickerProps> = ({ onEmojiSelect, onClose }) => {
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker if clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';

  return (
    <div ref={pickerRef}>
      <Picker
        onEmojiClick={(emojiData: any) => onEmojiSelect(emojiData.emoji)}
        theme={theme as "auto" | "light" | "dark"}
        width="100%"
        height={350}
        previewConfig={{ showPreview: false }}
      />
    </div>
  );
};

export default EmojiPicker;
