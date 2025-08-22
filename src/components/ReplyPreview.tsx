import { cn } from "@/lib/utils";
import type { Contact, Message } from "../types";

export const ReplyPreview = ({ replyTo, allKnownContacts }: { replyTo: Message['replyTo'], allKnownContacts: (Contact | {id: string; name: string})[] }) => {
    if (!replyTo) return null;
    const sender = allKnownContacts.find(c => c.id === replyTo.senderId);
    return (
      <div className={cn("mb-1 p-2 rounded-sm bg-muted backdrop-blur-sm border-l-2 border-muted-foreground pl-3 cursor-pointer hover:bg-muted/50 transition-colors max-w-sm overflow-hidden")} onClick={() => {
        const element = document.getElementById(replyTo.id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('animate-flash');
            setTimeout(() => {
                element.classList.remove('animate-flash');
            }, 1500);
        }
      }}>
        <div className="font-semibold text-xs text-muted-foreground">{sender?.name || replyTo.senderName}</div>
        <p className="text-sm text-muted-foreground truncate whitespace-nowrap break-words">{replyTo.text}</p>
      </div>
    );
  };
