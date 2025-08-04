import { createClient } from '@/lib/supabase/client';
import { AI_PERSONAS } from '../constants';

const supabase = createClient();

export class AiUserService {
  /**
   * Ensure all AI personas exist as users in the database
   */
  static async ensureAiUsersExist(): Promise<void> {
    try {
      console.log('Ensuring AI personas exist in User table...');
      
      for (const aiPersona of AI_PERSONAS) {
        // Check if AI user already exists
        const { data: existingUser, error: checkError } = await supabase
          .from('User')
          .select('id')
          .eq('id', aiPersona.id)
          .single();

        if (checkError && checkError.code !== 'PGRST116') {
          console.error(`Error checking AI user ${aiPersona.id}:`, checkError);
          continue;
        }

        // If user doesn't exist, create it
        if (!existingUser) {
          const { error: insertError } = await supabase
            .from('User')
            .insert({
              id: aiPersona.id,
              email: `${aiPersona.id}@ai.assistant`,
              name: aiPersona.name,
              avatarUrl: aiPersona.avatarUrl || null,
              status: 'online',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });

          if (insertError) {
            console.error(`Error creating AI user ${aiPersona.id}:`, insertError);
          } else {
            console.log(`AI user ${aiPersona.name} created successfully`);
          }
        } else {
          console.log(`AI user ${aiPersona.name} already exists`);
        }
      }
    } catch (error) {
      console.error('Error ensuring AI users exist:', error);
    }
  }

  /**
   * Create a single AI user if it doesn't exist
   */
  static async ensureAiUserExists(aiPersonaId: string): Promise<boolean> {
    try {
      const aiPersona = AI_PERSONAS.find(ai => ai.id === aiPersonaId);
      if (!aiPersona) {
        console.error(`AI persona ${aiPersonaId} not found in constants`);
        return false;
      }

      // Check if AI user already exists
      const { data: existingUser, error: checkError } = await supabase
        .from('User')
        .select('id')
        .eq('id', aiPersona.id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error(`Error checking AI user ${aiPersona.id}:`, checkError);
        return false;
      }

      // If user doesn't exist, create it
      if (!existingUser) {
        const { error: insertError } = await supabase
          .from('User')
          .insert({
            id: aiPersona.id,
            email: `${aiPersona.id}@ai.assistant`,
            name: aiPersona.name,
            avatarUrl: aiPersona.avatarUrl || null,
            status: 'online',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });

        if (insertError) {
          console.error(`Error creating AI user ${aiPersona.id}:`, insertError);
          return false;
        }
        
        console.log(`AI user ${aiPersona.name} created successfully`);
      }

      return true;
    } catch (error) {
      console.error(`Error ensuring AI user ${aiPersonaId} exists:`, error);
      return false;
    }
  }
}
