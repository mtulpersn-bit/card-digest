-- Add file_url column to documents table to store PDF file path
ALTER TABLE public.documents ADD COLUMN file_url text;