import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReadingCard {
  title: string;
  content: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId, documentContent, fileUrl } = await req.json();
    
    if (!documentId) {
      throw new Error('Document ID is required');
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let contentToProcess = documentContent;

    // If there's a PDF file, we'll process it (for now, we'll use the content field as fallback)
    // TODO: Implement OCR for PDF files when needed
    if (fileUrl && !documentContent) {
      // For now, we'll ask user to provide content or implement OCR later
      throw new Error('PDF OCR işlemi şu anda desteklenmiyor. Lütfen belgenizi manuel olarak oluşturun.');
    }

    if (!contentToProcess) {
      throw new Error('İşlenecek içerik bulunamadı');
    }

    console.log('Processing content with AI for document:', documentId);

    // AI prompt for reading card generation
    const systemPrompt = `You are a PDF reading assistant. Your goal is to help readers develop regular reading habits and make content easier to follow by converting content into "reading cards".

CRITICAL INSTRUCTIONS:
- You MUST ALWAYS respond in valid JSON format, no matter what
- Never respond with plain text or explanations
- If you cannot process the content, return an error in JSON format

Rules for content processing:
- Do not change the words in the text, keep them as they are
- Divide the text only according to topic headings and integrity
- Keep the order of cards faithful to the original order  
- Do not add additional summaries, comments or explanations
- Create appropriate titles for each card
- Final output should be natural reading cards that can be read in timeline flow

You MUST return ONLY this JSON format:
{
  "cards": [
    {
      "title": "Card title",
      "content": "Original text content"
    }
  ]
}

If there's an error or you cannot process the content, return:
{
  "error": "Error description",
  "cards": []
}`;

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
          { role: 'user', content: `Please convert the following content into reading cards. Remember to respond ONLY with valid JSON:\n\n${contentToProcess}` }
        ],
        max_tokens: 4000,
        temperature: 0.1
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const aiContent = aiResponse.choices[0].message.content;
    
    console.log('AI Response:', aiContent);

    // Parse AI response
    let cards: ReadingCard[];
    try {
      const parsed = JSON.parse(aiContent);
      
      // Check if AI returned an error
      if (parsed.error) {
        throw new Error(parsed.error);
      }
      
      cards = parsed.cards || [];
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      console.error('AI Response was:', aiContent);
      throw new Error('AI yanıtı geçerli JSON formatında değil. Lütfen tekrar deneyin.');
    }

    if (!cards.length) {
      throw new Error('AI içerik için okuma kartı oluşturamadı');
    }

    // Get the next card order
    const { data: existingCards } = await supabase
      .from('reading_cards')
      .select('card_order')
      .eq('document_id', documentId)
      .order('card_order', { ascending: false })
      .limit(1);

    let nextOrder = 1;
    if (existingCards && existingCards.length > 0) {
      nextOrder = existingCards[0].card_order + 1;
    }

    // Get user ID from the document
    const { data: document } = await supabase
      .from('documents')
      .select('user_id')
      .eq('id', documentId)
      .single();

    if (!document) {
      throw new Error('Belge bulunamadı');
    }

    // Insert reading cards
    const cardsToInsert = cards.map((card, index) => ({
      document_id: documentId,
      user_id: document.user_id,
      title: card.title,
      content: card.content,
      card_order: nextOrder + index
    }));

    const { error: insertError } = await supabase
      .from('reading_cards')
      .insert(cardsToInsert);

    if (insertError) {
      console.error('Error inserting cards:', insertError);
      throw new Error('Okuma kartları kaydedilemedi');
    }

    console.log(`Successfully created ${cards.length} AI reading cards`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `${cards.length} okuma kartı AI ile oluşturuldu`,
      cardsCount: cards.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-ai-reading-cards function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});