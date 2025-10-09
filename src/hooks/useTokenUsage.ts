import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TokenUsage {
  used: number;
  limit: number;
  isAdmin: boolean;
  loading: boolean;
}

export const useTokenUsage = (userId: string | undefined) => {
  const [tokenUsage, setTokenUsage] = useState<TokenUsage>({
    used: 0,
    limit: 30000,
    isAdmin: false,
    loading: true,
  });

  useEffect(() => {
    if (!userId) {
      setTokenUsage(prev => ({ ...prev, loading: false }));
      return;
    }

    const fetchTokenUsage = async () => {
      try {
        // Check if user is admin
        const { data: isAdminData } = await supabase.rpc('has_role', {
          _user_id: userId,
          _role: 'admin'
        });

        const isAdmin = isAdminData === true;

        // Get today's token usage
        const today = new Date().toISOString().split('T')[0];
        const { data: usageData } = await supabase
          .from('token_usage')
          .select('tokens_used')
          .eq('user_id', userId)
          .eq('usage_date', today)
          .maybeSingle();

        setTokenUsage({
          used: usageData?.tokens_used || 0,
          limit: 30000,
          isAdmin,
          loading: false,
        });
      } catch (error) {
        console.error('Error fetching token usage:', error);
        setTokenUsage(prev => ({ ...prev, loading: false }));
      }
    };

    fetchTokenUsage();

    // Refresh every 5 seconds for real-time updates
    const interval = setInterval(fetchTokenUsage, 5000);
    return () => clearInterval(interval);
  }, [userId]);
  
  const refreshTokenUsage = async () => {
    if (!userId) return;
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: usageData } = await supabase
        .from('token_usage')
        .select('tokens_used')
        .eq('user_id', userId)
        .eq('usage_date', today)
        .maybeSingle();

      setTokenUsage(prev => ({
        ...prev,
        used: usageData?.tokens_used || 0,
      }));
    } catch (error) {
      console.error('Error refreshing token usage:', error);
    }
  };

  const submitAdminCode = async (code: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.rpc('set_admin_with_code', {
        _code: code
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data && typeof data === 'object' && 'success' in data) {
        if (data.success) {
          // Refresh token usage to get updated admin status
          setTokenUsage(prev => ({ ...prev, isAdmin: true }));
          return { success: true };
        } else if ('error' in data) {
          return { success: false, error: data.error as string };
        }
      }

      return { success: false, error: 'Beklenmeyen bir hata oluştu' };
    } catch (error) {
      console.error('Error submitting admin code:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu' 
      };
    }
  };

  return { tokenUsage, submitAdminCode, refreshTokenUsage };
};
