
import React from 'react';
import { render, screen } from '@testing-library/react';
import MessageBubble from '../MessageBubble';
import type { Message, User, Contact } from '../../types';

const mockCurrentUser: User = { id: 'user1', name: 'Me' };
const mockOtherUser: User = { id: 'user2', name: 'Ben' };
const mockAllContacts: Contact[] = [
    { id: 'user1', name: 'Me', status: 'online' },
    { id: 'user2', name: 'Ben', status: 'online' },
];

const mockOnReact = jest.fn();
const mockOnForward = jest.fn();

describe('MessageBubble', () => {
  it('renders a message from the current user correctly', () => {
    const message: Message = {
      type: 'chat',
      id: 'msg1',
      contactId: 'user2',
      senderId: 'user1',
      senderName: 'Me',
      text: 'Hello from me!',
      timestamp: new Date().toISOString(),
      status: 'read',
    };

    render(
      <MessageBubble
        message={message}
        currentUser={mockCurrentUser}
        allContacts={mockAllContacts}
        onReact={mockOnReact}
        onForward={mockOnForward}
      />
    );

    const bubbleContainer = screen.getByText('Hello from me!').parentElement?.parentElement?.parentElement?.parentElement;
    // Messages from the current user are justified to the end (right)
    expect(bubbleContainer?.parentElement).toHaveClass('justify-end');
    // It should have a read receipt
    expect(screen.getByText('Hello from me!').parentElement?.parentElement?.parentElement?.nextElementSibling).toHaveTextContent(/read/i);
    expect(screen.queryByText('Me')).not.toBeInTheDocument(); // Don't show own name
  });

  it('renders a message from another user in a 1-on-1 chat', () => {
    const message: Message = {
      type: 'chat',
      id: 'msg2',
      contactId: 'user1',
      senderId: 'user2',
      senderName: 'Ben',
      text: 'Hello from Ben!',
      timestamp: new Date().toISOString(),
      isGroup: false,
    };

    render(
      <MessageBubble
        message={message}
        currentUser={mockCurrentUser}
        allContacts={mockAllContacts}
        isGroup={false}
        onReact={mockOnReact}
        onForward={mockOnForward}
      />
    );

    const bubbleContainer = screen.getByText('Hello from Ben!').parentElement?.parentElement?.parentElement?.parentElement;
    // Messages from others are justified to the start (left)
    expect(bubbleContainer?.parentElement).toHaveClass('justify-start');

    // In a 1-on-1 chat, we don't show the sender's name or avatar inside the bubble component
    expect(screen.queryByText('Ben')).not.toBeInTheDocument();
    // Check that no avatar is rendered
    const avatar = screen.queryByText('B');
    expect(avatar).not.toBeInTheDocument();
  });

  it('renders a message from another user in a group chat with name and avatar', () => {
    const message: Message = {
      type: 'chat',
      id: 'msg3',
      contactId: 'group1',
      senderId: 'user2',
      senderName: 'Ben',
      text: 'Hello group!',
      timestamp: new Date().toISOString(),
      isGroup: true,
    };

    render(
      <MessageBubble
        message={message}
        currentUser={mockCurrentUser}
        allContacts={mockAllContacts}
        isGroup={true}
        onReact={mockOnReact}
        onForward={mockOnForward}
      />
    );

    const bubbleContainer = screen.getByText('Hello group!').parentElement?.parentElement?.parentElement?.parentElement;
    expect(bubbleContainer?.parentElement?.parentElement).toHaveClass('justify-start');

    // In a group chat, we expect the sender's name and avatar
    expect(screen.getByText('Ben')).toBeInTheDocument();
    const avatar = screen.getByText('B');
    expect(avatar).toBeInTheDocument(); // The avatar should be present
  });
});
