
import React from 'react';
import { render, screen } from '@testing-library/react';
import GeneratedAvatar from '../GeneratedAvatar';
import type { Contact, User } from '../../types';

describe('GeneratedAvatar', () => {
  const mockCurrentUser: User = { id: 'user1', name: 'Current User' };
  const mockContacts: Contact[] = [
    { id: 'user1', name: 'Current User', status: 'online' },
    { id: 'user2', name: 'Ben', status: 'online' },
    { id: 'user3', name: 'Cathy', status: 'offline' },
  ];

  it('renders a single initial for a non-group avatar', () => {
    render(
      <GeneratedAvatar
        name="Alice"
        allContacts={mockContacts}
        currentUser={mockCurrentUser}
      />
    );

    const avatar = screen.getByText('A');
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveClass('text-xl'); // Check for single avatar styling
    expect(avatar.parentElement).toHaveClass('rounded-full');
  });

  it('renders a 2x2 grid for a group avatar', () => {
    render(
      <GeneratedAvatar
        name="Test Group"
        isGroup={true}
        memberIds={['user1', 'user2', 'user3']}
        creatorId="user2"
        allContacts={mockContacts}
        currentUser={mockCurrentUser}
      />
    );
    
    // Check that the container is a rounded-lg grid
    const container = screen.getByText('B').parentElement?.parentElement;
    expect(container).toHaveClass('rounded-lg', 'grid');

    // Creator 'Ben' should be first
    expect(screen.getByText('B')).toBeInTheDocument();
    // Current user 'You' should be next
    expect(screen.getByText('Y')).toBeInTheDocument();
    // Other member 'Cathy' should be next
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('prioritizes creator in group avatar', () => {
    const { getAllByText } = render(
      <GeneratedAvatar
        name="Group"
        isGroup
        memberIds={['user2', 'user3']}
        creatorId="user3" // Cathy is the creator
        allContacts={mockContacts}
        currentUser={mockCurrentUser}
      />
    );
    
    const initials = getAllByText(/[A-Z]/).map(el => el.textContent);
    // Expected: Creator (Cathy), then other member (Ben)
    expect(initials[0]).toBe('C');
    expect(initials[1]).toBe('B');
  });

  it('handles fewer than 4 members gracefully', () => {
    render(
      <GeneratedAvatar
        name="Small Group"
        isGroup
        memberIds={['user2']}
        creatorId="user2"
        allContacts={mockContacts}
        currentUser={mockCurrentUser}
      />
    );

    expect(screen.getByText('B')).toBeInTheDocument();
    // Check for placeholder divs
    const container = screen.getByText('B').parentElement?.parentElement;
    const placeholders = container?.querySelectorAll('.bg-slate-100');
    expect(placeholders?.length).toBe(3);
  });
});
