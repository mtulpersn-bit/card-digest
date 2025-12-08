-- Add is_public column to documents (default false = private)
ALTER TABLE public.documents 
ADD COLUMN is_public boolean NOT NULL DEFAULT false;

-- Add view_count column to flashcards for spaced repetition algorithm
ALTER TABLE public.flashcards 
ADD COLUMN view_count integer NOT NULL DEFAULT 0;

-- Drop existing SELECT policy for documents
DROP POLICY IF EXISTS "Documents are viewable by everyone" ON public.documents;

-- Create new SELECT policy: users can see their own documents OR public documents
CREATE POLICY "Users can view own or public documents" 
ON public.documents 
FOR SELECT 
USING (auth.uid() = user_id OR is_public = true);

-- Update reading_cards SELECT policy to only show cards from visible documents
DROP POLICY IF EXISTS "Reading cards are viewable by everyone" ON public.reading_cards;

CREATE POLICY "Reading cards viewable based on document visibility" 
ON public.reading_cards 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.documents 
    WHERE documents.id = reading_cards.document_id 
    AND (documents.user_id = auth.uid() OR documents.is_public = true)
  )
);