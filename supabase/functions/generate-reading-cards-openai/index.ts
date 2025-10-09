import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentContent, documentId, userId, promptType, customPrompt, pageRange } = await req.json();

    if (!documentContent || !documentId || !userId) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const contentLength = documentContent.length;
    console.log('Generating reading cards with OpenAI for document:', documentId);
    console.log('Content length:', contentLength, 'characters');

    if (contentLength < 50) {
      return new Response(JSON.stringify({ error: 'Belge içeriği çok kısa. En az 50 karakter gerekli.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user is admin
    const { data: isAdminData } = await supabase.rpc('has_role', {
      _user_id: userId,
      _role: 'admin'
    });
    
    const isAdmin = isAdminData === true;
    console.log('User is admin:', isAdmin);

    // If not admin, check daily token limit
    if (!isAdmin) {
      const DAILY_TOKEN_LIMIT = 30000;
      const today = new Date().toISOString().split('T')[0];

      const { data: tokenUsageData } = await supabase
        .from('token_usage')
        .select('tokens_used')
        .eq('user_id', userId)
        .eq('usage_date', today)
        .maybeSingle();

      const currentUsage = tokenUsageData?.tokens_used || 0;
      console.log('Current token usage:', currentUsage, 'of', DAILY_TOKEN_LIMIT);

      if (currentUsage >= DAILY_TOKEN_LIMIT) {
        return new Response(JSON.stringify({ 
          error: 'Günlük token limitiniz doldu. Lütfen yarın tekrar deneyin veya admin olun.',
          limitReached: true
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    let systemPrompt = '';
    
    if (customPrompt && customPrompt.trim()) {
      // Özel prompt kullan
      systemPrompt = customPrompt.trim();
    } else if (promptType === 'structured') {
      // Yapılandırılmış prompt
      systemPrompt = `Sen bir PDF okuma asistanısın. Amacın, okuyucunun okuma alışkanlığı kazanması ve PDF içeriğini kolayca takip edebilmesi için "okuma kartları" oluşturmak.

Bu belge içeriğini analiz ederek:
1. Metindeki ana başlıkları ve alt başlıkları belirle (yoksa metinden sapmadan kendi başlık ve alt başlıklarını oluştur)
2. Metinleri alt başlıklara göre sınıflandır
3. Her okuma kartına bir ana başlık, bir alt başlık ve ilgili metni yerleştir
4. Bir ana başlık birden fazla okuma kartında olabilir
5. Alt başlıklar okuma kartlarını sınıflandırır, her kartta ana başlık da yer almalı
6. Her kartı "=== KART [NUMARA] ===" ile ayır

Örnek format:
=== KART 1 ===
Ana Başlık: [Başlık]
Alt Başlık: [Alt başlık]
[Orijinal metin bölümü]

=== KART 2 ===
Ana Başlık: [Başlık]
Alt Başlık: [Alt başlık]
[Orijinal metin bölümü]`;
    } else {
      // Varsayılan prompt
      systemPrompt = `Sen bir PDF okuma asistanısın. Amacın, okuyucunun okuma alışkanlığı kazanması ve PDF içeriğini kolayca takip edebilmesi için "okuma kartları" oluşturmak. Kurallar:

Bu belge içeriğini analiz ederek:
1. Metni konusuna ve bütünlüğe göre anlamlı parçalara ayır
2. Her bölüm için bir "okuma kartı" oluştur
3. Her kartta sadece metin yer alsın, başlık ekleme
4. Kelimeleri değiştirme
5. PDF sıralamasına sadık kal
6. Her kartı "=== KART [NUMARA] ===" ile ayır

Örnek format:
=== KART 1 ===
[Orijinal metin bölümü]

=== KART 2 ===
[Orijinal metin bölümü]`;
    }
    
    // Sayfa aralığı varsa ekle
    let finalContent = documentContent;
    if (pageRange && pageRange !== 'all') {
      systemPrompt += `\n\nÖNEMLİ: Sadece ${pageRange} sayfa aralığındaki içeriği analiz et.`;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: finalContent }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      return new Response(JSON.stringify({ error: 'OpenAI API error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const generatedText = data.choices[0].message.content;
    const tokensUsed = data.usage?.total_tokens || 0;

    console.log('Generated text:', generatedText);
    console.log('Tokens used:', tokensUsed);

    // Track token usage (only for non-admin users)
    if (!isAdmin && tokensUsed > 0) {
      const today = new Date().toISOString().split('T')[0];
      
      // Get current usage
      const { data: currentUsageData } = await supabase
        .from('token_usage')
        .select('tokens_used')
        .eq('user_id', userId)
        .eq('usage_date', today)
        .maybeSingle();

      const currentTokens = currentUsageData?.tokens_used || 0;
      const newTotal = currentTokens + tokensUsed;

      // Upsert with new total
      const { error: tokenError } = await supabase
        .from('token_usage')
        .upsert({
          user_id: userId,
          usage_date: today,
          tokens_used: newTotal,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,usage_date'
        });

      if (tokenError) {
        console.error('Error tracking token usage:', tokenError);
      } else {
        console.log('Token usage tracked successfully:', newTotal);
      }
    }

    // Parse the generated text to extract individual cards
    const cardSections = generatedText.split(/=== KART \d+ ===/);
    const cards = cardSections
      .slice(1) // Skip the first empty element
      .map((section: string) => section.trim())
      .filter((section: string) => section.length > 0);

    console.log(`Parsed ${cards.length} cards`);

    // Get the current max card_order for this document
    const { data: maxOrderData } = await supabase
      .from('reading_cards')
      .select('card_order')
      .eq('document_id', documentId)
      .order('card_order', { ascending: false })
      .limit(1);

    let nextOrder = maxOrderData && maxOrderData.length > 0 ? maxOrderData[0].card_order + 1 : 0;

    // Insert the cards into the database
    const cardsToInsert = cards.map((content: string, index: number) => ({
      user_id: userId,
      document_id: documentId,
      title: `Kart ${nextOrder + index + 1}`,
      content: content,
      card_order: nextOrder + index,
      image_url: null
    }));

    const { error: insertError } = await supabase
      .from('reading_cards')
      .insert(cardsToInsert);

    if (insertError) {
      console.error('Error inserting cards:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to insert cards' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Successfully inserted ${cards.length} cards`);

    return new Response(JSON.stringify({ 
      success: true, 
      cardsCreated: cards.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-reading-cards-openai function:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
