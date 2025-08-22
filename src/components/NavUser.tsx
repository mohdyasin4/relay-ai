import React from 'react';
import { IconDotsVertical, IconLogout, IconSettings, IconUserCircle } from '@tabler/icons-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';

interface NavUserProps {
  user: { name: string; email?: string; avatar?: string };
  onSettings: () => void;
  onLogout: () => void;
  onNotifications?: () => void;
  pendingNotifications?: number;
  isMobile?: boolean;
  showOnlineStatus?: boolean;
}

export const NavUser: React.FC<NavUserProps> = ({ user, onSettings, onLogout, onNotifications, pendingNotifications = 0, isMobile = false, showOnlineStatus = false }) => {
  const { isMobile: sidebarIsMobile } = useSidebar();

  const initials = (user.name || 'U').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();

  return (
    <SidebarMenu className={`${isMobile ? "w-fit" : "w-full"}`}>
      <SidebarMenuItem>
        <div className="flex items-center gap-2 px-2 py-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton size="lg" className={`cursor-pointer data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground flex-1`}>
                <div className="relative">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={user.avatar || '/placeholder.svg'} alt={user.name} />
                    <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                  </Avatar>
                  {showOnlineStatus && <div className="online-indicator"></div>}
                </div>
                {!isMobile && (
                  <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                    <span className="truncate font-medium">{user.name}</span>
                    {showOnlineStatus ? (
                      <span className="text-green-500 truncate text-xs">Online</span>
                    ) : user.email ? (
                      <span className="text-muted-foreground truncate text-xs">{user.email}</span>
                    ) : null}
                  </div>
                )}
                {!isMobile && <IconDotsVertical className="ml-auto size-4" />}
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 rounded-lg" side={'bottom'} align={`${isMobile ? "end" : "start"}`} sideOffset={6}>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={user.avatar || '/placeholder.svg'} alt={user.name} />
                    <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                    <span className="truncate font-medium">{user.name}</span>
                    {user.email && (
                      <span className="text-muted-foreground truncate text-xs">{user.email}</span>
                    )}
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={onSettings}>
                  <IconSettings />
                  Settings
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant='destructive' onClick={onLogout}>
                <IconLogout />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon" className="relative" onClick={onNotifications} aria-label="Notifications">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-bell"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
            {pendingNotifications > 0 && (
              <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 text-xs p-0 flex items-center justify-center">
                {pendingNotifications > 9 ? '9+' : pendingNotifications}
              </Badge>
            )}
            <span className="sr-only">Notifications</span>
          </Button>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};

export default NavUser;



