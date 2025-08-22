import React from 'react';
import { Badge } from './badge';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';
import { HoverCard, HoverCardContent, HoverCardTrigger } from './hover-card';
import { cn } from '@/lib/utils';
import { getSenderColorClass, getSenderToneClasses } from '@/utils/colorUtils';

interface Contact {
	id: string;
	name: string;
	avatarUrl?: string;
}

interface MentionTextProps {
	text: string;
	contacts: Contact[];
	className?: string;
}

export const MentionText: React.FC<MentionTextProps> = ({ text, contacts, className }) => {


	const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

	const processMentions = (text: string): React.ReactNode[] => {
		if (!text) return [text];

		// Build one combined regex of all names (sorted by length desc to avoid partials)
		const sorted = [...contacts].sort((a, b) => (b.name?.length || 0) - (a.name?.length || 0));
		const nameToContact = new Map<string, Contact>();
		const escapedNames: string[] = [];
		for (const c of sorted) {
			if (!c.name) continue;
			const key = c.name;
			nameToContact.set(key, c);
			escapedNames.push(escapeRegExp(key));
		}
		if (escapedNames.length === 0) return [text];

		const pattern = new RegExp(`(^|\\s)@(${escapedNames.join('|')})(?!\\S)`, 'g');
		const result: React.ReactNode[] = [];
		let lastIndex = 0;
		let match: RegExpExecArray | null;

		while ((match = pattern.exec(text)) !== null) {
			const start = match.index;
			const prefix = match[1] || '';
			const name = match[2];
			const before = text.slice(lastIndex, start);
			if (before) result.push(before);
			if (prefix) result.push(prefix);

			const contact = nameToContact.get(name);
			if (contact) {
				const { text: toneText, bg: toneBg } = getSenderToneClasses(contact.id || contact.name);
				result.push(
					<HoverCard key={`mention-${contact.id}-${start}`}>
						<HoverCardTrigger asChild>
							<Badge
									variant="secondary"
									className={cn('inline-flex items-center gap-1 px-1 py-[2px] text-xs font-semibold rounded-sm transition-shadow duration-150', toneText, toneBg)}
							>
								@{contact.name}
							</Badge>
						</HoverCardTrigger>
						<HoverCardContent className="flex items-center gap-3 w-64">
							<Avatar>
								<AvatarImage src={contact.avatarUrl || ''} alt={contact.name} />
								<AvatarFallback>{contact.name?.slice(0, 1).toUpperCase()}</AvatarFallback>
							</Avatar>
							<div className="flex flex-col">
								<span className="font-semibold">{contact.name}</span>
								<span className="text-xs text-muted-foreground">View profile</span>
							</div>
						</HoverCardContent>
					</HoverCard>
				);
			}
			lastIndex = pattern.lastIndex;
		}

		// Tail
		if (lastIndex < text.length) {
			result.push(text.slice(lastIndex));
		}
		return result.length > 0 ? result : [text];
	};

	return (
		<div className={cn('break-words inter-double-storey', className)}>
			{processMentions(text)}
		</div>
	);
};
