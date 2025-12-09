-- Add is_public column to reading_cards (default follows document visibility)
ALTER TABLE public.reading_cards
ADD COLUMN is_public boolean NOT NULL DEFAULT false;

-- Update reading_cards SELECT policy to respect card-level visibility
DROP POLICY IF EXISTS "Reading cards viewable based on document visibility" ON public.reading_cards;

CREATE POLICY "Reading cards viewable based on visibility"
ON public.reading_cards
FOR SELECT
USING (
  auth.uid() = user_id 
  OR (
    is_public = true 
    AND EXISTS (
      SELECT 1 FROM public.documents
      WHERE documents.id = reading_cards.document_id
      AND documents.is_public = true
    )
  )
);