# Prisma & Supabase Setup Instructions

## Setup Steps

1. **Create a Supabase Project**:
   - Go to [Supabase](https://supabase.com/) and create a new project
   - Get your project URL and API keys from the project settings

2. **Update Environment Variables**:
   - Update the `.env.local` file with your Supabase credentials:
     ```
     SUPABASE_URL=https://your-project-id.supabase.co
     SUPABASE_ANON_KEY=your-anon-key
     SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
     DATABASE_URL=postgresql://postgres:your-db-password@your-project-id.supabase.co:5432/postgres
     ```

3. **Run Prisma Migration**:
   - Run the following command to generate the migration files:
     ```
     npx prisma migrate dev --name init
     ```
   - This will create the database tables in your Supabase PostgreSQL database

4. **Generate Prisma Client**:
   - Run the following command to generate the Prisma client:
     ```
     npx prisma generate
     ```

## Using Prisma with Supabase Auth

The project is now configured to:
- Use Supabase for authentication
- Store user data in Supabase PostgreSQL using Prisma
- Sync user data between Supabase Auth and your database

When a user signs up or logs in:
1. Supabase Auth handles authentication
2. The `syncUserFromSupabase` function creates/updates the user in your database
3. Your app can now use both Supabase Auth and Prisma for data operations

## Common Operations

### Authentication
```typescript
// Sign in with email
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123'
});

// Sign in with Google
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google'
});

// Sign out
await supabase.auth.signOut();
```

### Database Operations
```typescript
// Get user data
const user = await DatabaseService.getUserById('user-id');

// Get user contacts
const contacts = await DatabaseService.getUserContacts('user-id');

// Send a message
const message = await DatabaseService.createMessage({
  text: 'Hello world',
  senderId: 'user-id',
  recipientId: 'recipient-id'
});
```
