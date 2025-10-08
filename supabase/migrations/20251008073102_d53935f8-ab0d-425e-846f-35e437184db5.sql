-- Enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- User roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Token usage tracking table
CREATE TABLE public.token_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  tokens_used integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE (user_id, usage_date)
);

ALTER TABLE public.token_usage ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own user role"
ON public.user_roles
FOR INSERT
WITH CHECK (auth.uid() = user_id AND role = 'user');

-- RLS Policies for token_usage
CREATE POLICY "Users can view their own token usage"
ON public.token_usage
FOR SELECT
USING (auth.uid() = user_id);

-- Function to set admin role with code
CREATE OR REPLACE FUNCTION public.set_admin_with_code(_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
BEGIN
  -- Check if code is correct
  IF _code != 'Ads122129.' THEN
    RETURN json_build_object('success', false, 'error', 'Geçersiz admin kodu');
  END IF;
  
  _user_id := auth.uid();
  
  IF _user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Kullanıcı oturumu bulunamadı');
  END IF;
  
  -- Insert or ignore if already admin
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'admin'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN json_build_object('success', true);
END;
$$;