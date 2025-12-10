-- Drop the insecure set_admin_with_code function
DROP FUNCTION IF EXISTS public.set_admin_with_code(text);

-- Fix profiles table RLS policy - restrict to owner-only access
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

-- Fix flashcards table RLS policy - restrict based on ownership or document visibility
DROP POLICY IF EXISTS "Flashcards are viewable by everyone" ON public.flashcards;

CREATE POLICY "Users can view own or public flashcards"
ON public.flashcards FOR SELECT
USING (
  auth.uid() = user_id 
  OR EXISTS (
    SELECT 1 FROM public.documents 
    WHERE documents.id = flashcards.document_id 
    AND documents.is_public = true
  )
);