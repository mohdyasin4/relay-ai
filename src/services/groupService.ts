import { createClient } from '@/lib/supabase/client';
import type { Contact } from '../types';
import { generateUUID } from '@/utils/uuidUtils';

const supabase = createClient();

export class GroupService {
  /**
   * Create a new group in the database
   */
  static async createGroup(name: string, creatorId: string, memberIds: string[]): Promise<Contact> {
    try {
      console.log('Creating group in database:', { name, creatorId, memberIds });
      
      // Create the group with explicit ID and timestamps
      const groupId = generateUUID();
      const now = new Date().toISOString();
      const allMemberIds = [...new Set([creatorId, ...memberIds])]; // Include all members including AI
      const { data: group, error: groupError } = await supabase
        .from('Group')
        .insert({
          id: groupId,
          name,
          creatorId,
          memberIds: allMemberIds, // Store complete member list including AI personas
          createdAt: now,
          updatedAt: now
        })
        .select('*')
        .single();

      if (groupError) {
        console.error('Error creating group:', groupError);
        throw new Error(`Failed to create group: ${groupError.message}`);
      }

      console.log('Group created successfully:', group);

      // Filter out AI personas from memberIds for database storage
      // AI personas will be handled locally in the app
      const { AI_PERSONAS } = await import('../constants');
      const aiPersonaIds = AI_PERSONAS.map(ai => ai.id);
      
      // Add members to the group (including creator, but excluding AI personas)
      const realUserIds = [...new Set([creatorId, ...memberIds])].filter(id => !aiPersonaIds.includes(id));
      
      if (realUserIds.length > 0) {
        const groupMemberInserts = realUserIds.map(memberId => ({
          A: group.id, // A = group ID
          B: memberId  // B = user ID
        }));

        const { error: membersError } = await supabase
          .from('_GroupMembers')
          .insert(groupMemberInserts);

        if (membersError) {
          console.error('Error adding group members:', membersError);
          // Try to clean up the group if member addition fails
          await supabase.from('Group').delete().eq('id', group.id);
          throw new Error(`Failed to add group members: ${membersError.message}`);
        }

        console.log('Group members added successfully');
      }

      // Return the group as a Contact object with all memberIds (including AI personas)
      const groupContact: Contact = {
        id: group.id,
        name: group.name,
        isGroup: true,
        isAi: false,
        creatorId: group.creatorId,
        memberIds: allMemberIds, // Use the complete member list from the database
        status: 'online',
      };

      return groupContact;
    } catch (error) {
      console.error('Error in createGroup:', error);
      throw error;
    }
  }

  /**
   * Get all groups for a user
   */
  static async getUserGroups(userId: string): Promise<Contact[]> {
    try {
      console.log('Getting groups for user:', userId);

      // First get all group IDs for this user
      const { data: membershipData, error: membershipError } = await supabase
        .from('_GroupMembers')
        .select('A')
        .eq('B', userId);

      if (membershipError) {
        console.error('Error fetching user group memberships:', membershipError);
        throw new Error(`Failed to fetch group memberships: ${membershipError.message}`);
      }

      if (!membershipData || membershipData.length === 0) {
        console.log('No groups found for user');
        return [];
      }

      const groupIds = membershipData.map(m => m.A);

      // Now get the group details
      const { data: groups, error: groupsError } = await supabase
        .from('Group')
        .select('*')
        .in('id', groupIds);

      if (groupsError) {
        console.error('Error fetching group details:', groupsError);
        throw new Error(`Failed to fetch groups: ${groupsError.message}`);
      }

      // Convert groups to Contact objects
      const groupContacts: Contact[] = [];
      
      for (const group of groups || []) {
        // Use the stored memberIds which includes AI personas
        const memberIds = group.memberIds || [];

        groupContacts.push({
          id: group.id,
          name: group.name,
          isGroup: true,
          isAi: false,
          creatorId: group.creatorId,
          memberIds: memberIds, // Complete member list including AI personas
          status: 'online',
        });
      }

      console.log('Groups fetched from database:', groupContacts);
      return groupContacts;
    } catch (error) {
      console.error('Error in getUserGroups:', error);
      throw error;
    }
  }

  /**
   * Update a group's name and members
   */
  static async updateGroup(groupId: string, name: string, memberIds: string[], creatorId: string): Promise<void> {
    try {
      console.log('Updating group:', { groupId, name, memberIds, creatorId });

      // Update group name, memberIds, and timestamp
      const allMemberIds = [...new Set([creatorId, ...memberIds])]; // Include all members including AI
      const { error: updateError } = await supabase
        .from('Group')
        .update({ 
          name,
          memberIds: allMemberIds, // Store complete member list including AI personas
          updatedAt: new Date().toISOString()
        })
        .eq('id', groupId);

      if (updateError) {
        console.error('Error updating group name:', updateError);
        throw new Error(`Failed to update group: ${updateError.message}`);
      }

      // Remove all existing members
      const { error: deleteError } = await supabase
        .from('_GroupMembers')
        .delete()
        .eq('A', groupId);

      if (deleteError) {
        console.error('Error removing existing group members:', deleteError);
        throw new Error(`Failed to update group members: ${deleteError.message}`);
      }

      // Filter out AI personas from memberIds for database storage
      const { AI_PERSONAS } = await import('../constants');
      const aiPersonaIds = AI_PERSONAS.map(ai => ai.id);
      
      // Add new members (including creator, but excluding AI personas)
      const realUserIds = [...new Set([creatorId, ...memberIds])].filter(id => !aiPersonaIds.includes(id));
      
      if (realUserIds.length > 0) {
        const groupMemberInserts = realUserIds.map(memberId => ({
          A: groupId, // A = group ID
          B: memberId  // B = user ID
        }));

        const { error: insertError } = await supabase
          .from('_GroupMembers')
          .insert(groupMemberInserts);

        if (insertError) {
          console.error('Error adding new group members:', insertError);
          throw new Error(`Failed to update group members: ${insertError.message}`);
        }
      }

      console.log('Group updated successfully');
    } catch (error) {
      console.error('Error in updateGroup:', error);
      throw error;
    }
  }

  /**
   * Delete a group
   */
  static async deleteGroup(groupId: string): Promise<void> {
    try {
      console.log('Deleting group:', groupId);

      const { error } = await supabase
        .from('Group')
        .delete()
        .eq('id', groupId);

      if (error) {
        console.error('Error deleting group:', error);
        throw new Error(`Failed to delete group: ${error.message}`);
      }

      console.log('Group deleted successfully');
    } catch (error) {
      console.error('Error in deleteGroup:', error);
      throw error;
    }
  }

  /**
   * Check if a user is a member of a group
   */
  static async isGroupMember(groupId: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('_GroupMembers')
        .select('A')
        .eq('A', groupId)
        .eq('B', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error('Error checking group membership:', error);
        throw new Error(`Failed to check group membership: ${error.message}`);
      }

      return !!data;
    } catch (error) {
      console.error('Error in isGroupMember:', error);
      throw error;
    }
  }
}
