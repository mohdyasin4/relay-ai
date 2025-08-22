import { Forward } from "lucide-react";
import { Avatar as HeroAvatar } from "@heroui/react";

export const OtherUserAvatar = ({ sender }) => (
    <div className="flex-shrink-0">
        <HeroAvatar
            src={sender?.avatarUrl}
            name={sender?.name || "Unknown"}
            size="sm"
            className="rounded-full"
        />
    </div>
);

export const ForwardedMessageIndicator = () => (
  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
    <Forward className="w-3 h-3" />
    <span>Forwarded message</span>
  </div>
);
