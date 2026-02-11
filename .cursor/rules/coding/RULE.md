---
alwaysApply: true
---
# Best Practices
When possible, avoid using props as if there is already a hook or context that provides the data you need. For instance, instead of passing `session` to a component, use the `useAuth` hook to get the user ID.
Don't remove any existing comments unless asked to do so.
Don't add meaningless try - excepts that just silently fail

# Environment Variables
Env variables are managed by Doppler.
We validate the env variables using Zod, so you don't need to worry about them not existing as long as they are in the schema.

# UI Components
This project uses Nativewind and TailwindCSS for styling.
Similar to conventions of shadcn, we use common reusable building block components from the `@/components/ui` folder. Otherwise the component should be created in the `@/components` folder.

# Supabase
Unless the migration file is given, create migration files using Supabase CLI. For instance, 'supabase migration new create_employees_table' where 'create_employees_table' is the name of the migration file.
When using extensions in the migration file, make sure to use the `extensions.` prefix. For instance, `extensions.uuid_generate_v4()`.
Always enable RLS for newly created tables. Important: Ask for the policy permissions if not specified.