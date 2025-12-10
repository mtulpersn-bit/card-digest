import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useAdminCheck = (userId: string | undefined) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!userId) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        const { data: isAdminData } = await supabase.rpc('has_role', {
          _user_id: userId,
          _role: 'admin'
        });

        setIsAdmin(isAdminData === true);
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, [userId]);

  return { isAdmin, loading };
};
