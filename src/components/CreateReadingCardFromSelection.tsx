import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Loader2 } from 'lucide-react';

interface CreateReadingCardFromSelectionProps {
  documentId: string;
  selectedText: string;
  isOpen: boolean;
  onClose: () => void;
}

const CreateReadingCardFromSelection = ({ 
  documentId, 
  selectedText, 
  isOpen, 
  onClose 
}: CreateReadingCardFromSelectionProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [titlePrompt, setTitlePrompt] = useState('');
  const [contentPrompt, setContentPrompt] = useState('');
  const [isAILoading, setIsAILoading] = useState(false);

  useEffect(() => {
    if (isOpen && selectedText) {
      setContent(selectedText);
      setTitle('');
      setTitlePrompt('');
      setContentPrompt('');
    }
  }, [isOpen, selectedText]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim() || !content.trim()) return;

    setIsLoading(true);
    try {
      const { data: maxOrderData } = await supabase
        .from('reading_cards')
        .select('card_order')
        .eq('document_id', documentId)
        .order('card_order', { ascending: false })
        .limit(1);

      const nextOrder = maxOrderData && maxOrderData.length > 0 ? maxOrderData[0].card_order + 1 : 0;

      const { error } = await supabase
        .from('reading_cards')
        .insert({
          user_id: user.id,
          document_id: documentId,
          title: title.trim(),
          content: content.trim(),
          card_order: nextOrder
        });

      if (error) throw error;

      toast({
        title: "Okuma kartı oluşturuldu",
        description: "Yeni okuma kartı başarıyla eklendi.",
      });

      setTitle('');
      setContent('');
      onClose();
    } catch (error) {
      console.error('Error creating reading card:', error);
      toast({
        title: "Hata",
        description: "Okuma kartı oluşturulurken bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAITransform = async (type: 'title' | 'content', action: string) => {
    setIsAILoading(true);
    try {
      const textToTransform = type === 'title' ? title : content;
      const customPrompt = type === 'title' ? titlePrompt : contentPrompt;

      let prompt = '';
      if (action === 'grammar') {
        prompt = `Aşağıdaki metni düzelt ve gramer hatalarını gider:\n\n${textToTransform}`;
      } else if (action === 'clarify') {
        prompt = `Aşağıdaki metni daha anlaşılır hale getir:\n\n${textToTransform}`;
      } else if (action === 'generate-title') {
        prompt = `Aşağıdaki okuma metnine göre uygun bir başlık oluştur (sadece başlığı yaz):\n\n${content}`;
      } else if (action === 'custom') {
        prompt = `${customPrompt}\n\n${textToTransform}`;
      }

      // Call OpenAI via edge function
      const { data, error } = await supabase.functions.invoke('ai-text-transform', {
        body: { prompt }
      });

      if (error) throw error;

      if (data?.transformedText) {
        if (type === 'title') {
          setTitle(data.transformedText);
        } else {
          setContent(data.transformedText);
        }
        toast({
          title: "Metin güncellendi",
          description: "AI ile metin başarıyla dönüştürüldü.",
        });
      }
    } catch (error) {
      console.error('Error transforming text:', error);
      toast({
        title: "Hata",
        description: "Metin dönüştürülürken bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsAILoading(false);
      setTitlePrompt('');
      setContentPrompt('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Okuma Kartı Oluştur</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="title">Başlık *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" disabled={isAILoading}>
                    <Sparkles className="w-4 h-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">AI Dönüşüm Seçenekleri</h4>
                    <div className="space-y-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => handleAITransform('title', 'grammar')}
                        disabled={isAILoading || !title.trim()}
                      >
                        {isAILoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        Grameri düzelt
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => handleAITransform('title', 'clarify')}
                        disabled={isAILoading || !title.trim()}
                      >
                        {isAILoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        Daha anlaşılır hale çevir
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => handleAITransform('title', 'generate-title')}
                        disabled={isAILoading || !content.trim()}
                      >
                        {isAILoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        Okuma metnine göre otomatik başlık oluştur
                      </Button>
                      <div className="space-y-2 pt-2 border-t">
                        <Textarea
                          placeholder="Kendi komutunuzu girin..."
                          value={titlePrompt}
                          onChange={(e) => setTitlePrompt(e.target.value)}
                          className="min-h-[60px]"
                        />
                        <Button
                          type="button"
                          size="sm"
                          className="w-full"
                          onClick={() => handleAITransform('title', 'custom')}
                          disabled={isAILoading || !titlePrompt.trim() || !title.trim()}
                        >
                          {isAILoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                          Uygula
                        </Button>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Başlık..."
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="content">Okuma Metni *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" disabled={isAILoading}>
                    <Sparkles className="w-4 h-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">AI Dönüşüm Seçenekleri</h4>
                    <div className="space-y-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => handleAITransform('content', 'grammar')}
                        disabled={isAILoading || !content.trim()}
                      >
                        {isAILoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        Grameri düzelt
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => handleAITransform('content', 'clarify')}
                        disabled={isAILoading || !content.trim()}
                      >
                        {isAILoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        Daha anlaşılır hale çevir
                      </Button>
                      <div className="space-y-2 pt-2 border-t">
                        <Textarea
                          placeholder="Kendi komutunuzu girin..."
                          value={contentPrompt}
                          onChange={(e) => setContentPrompt(e.target.value)}
                          className="min-h-[60px]"
                        />
                        <Button
                          type="button"
                          size="sm"
                          className="w-full"
                          onClick={() => handleAITransform('content', 'custom')}
                          disabled={isAILoading || !contentPrompt.trim() || !content.trim()}
                        >
                          {isAILoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                          Uygula
                        </Button>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Okuma metni..."
              className="min-h-[150px]"
              required
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              İptal
            </Button>
            <Button type="submit" disabled={isLoading || !title.trim() || !content.trim()}>
              {isLoading ? "Oluşturuluyor..." : "Oluştur"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateReadingCardFromSelection;
