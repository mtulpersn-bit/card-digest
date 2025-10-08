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
    const { documentContent, documentId, userId } = await req.json();

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

    const systemPrompt = `Sen bir PDF okuma asistanısın. Amacın, okuyucunun okuma alışkanlığı kazanması ve PDF içeriğini kolayca takip edebilmesi için "okuma kartları" oluşturmak. Kurallar:

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
          { role: 'user', content: documentContent }
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

    console.log('Generated text:', generatedText);

    // Parse the generated text to extract individual cards
    const cardSections = generatedText.split(/=== KART \d+ ===/);
    const cards = cardSections
      .slice(1) // Skip the first empty element
      .map((section: string) => section.trim())
      .filter((section: string) => section.length > 0);

    console.log(`Parsed ${cards.length} cards`);

    // Get the current max card_order for this document
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
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
