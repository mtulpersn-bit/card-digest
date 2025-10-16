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

interface CreateFlashcardDialogProps {
  documentId: string;
  selectedText: string;
  isOpen: boolean;
  onClose: () => void;
}

const CreateFlashcardDialog = ({ documentId, selectedText, isOpen, onClose }: CreateFlashcardDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [questionPrompt, setQuestionPrompt] = useState('');
  const [answerPrompt, setAnswerPrompt] = useState('');
  const [isAILoading, setIsAILoading] = useState(false);

  useEffect(() => {
    if (isOpen && selectedText) {
      setAnswer(selectedText);
      setQuestion('');
      setQuestionPrompt('');
      setAnswerPrompt('');
    }
  }, [isOpen, selectedText]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !question.trim() || !answer.trim()) return;

    setIsLoading(true);
    try {
      const { data: maxOrderData } = await supabase
        .from('flashcards')
        .select('card_order')
        .eq('document_id', documentId)
        .order('card_order', { ascending: false })
        .limit(1);

      const nextOrder = maxOrderData && maxOrderData.length > 0 ? maxOrderData[0].card_order + 1 : 0;

      const { error } = await supabase
        .from('flashcards')
        .insert({
          user_id: user.id,
          document_id: documentId,
          question: question.trim(),
          answer: answer.trim(),
          card_order: nextOrder
        });

      if (error) throw error;

      toast({
        title: "Flashcard oluşturuldu",
        description: "Yeni flashcard başarıyla eklendi.",
      });

      setQuestion('');
      setAnswer('');
      onClose();
    } catch (error) {
      console.error('Error creating flashcard:', error);
      toast({
        title: "Hata",
        description: "Flashcard oluşturulurken bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAITransform = async (type: 'question' | 'answer', action: string) => {
    setIsAILoading(true);
    try {
      const textToTransform = type === 'question' ? question : answer;
      const customPrompt = type === 'question' ? questionPrompt : answerPrompt;

      let prompt = '';
      if (action === 'grammar') {
        prompt = `Aşağıdaki metni düzelt ve gramer hatalarını gider:\n\n${textToTransform}`;
      } else if (action === 'clarify') {
        prompt = `Aşağıdaki metni daha anlaşılır hale getir:\n\n${textToTransform}`;
      } else if (action === 'generate-question') {
        prompt = `Aşağıdaki cevaba göre uygun bir soru oluştur:\n\n${answer}`;
      } else if (action === 'custom') {
        prompt = `${customPrompt}\n\n${textToTransform}`;
      }

      // Call OpenAI via edge function
      const { data, error } = await supabase.functions.invoke('ai-text-transform', {
        body: { prompt }
      });

      if (error) throw error;

      if (data?.transformedText) {
        if (type === 'question') {
          setQuestion(data.transformedText);
        } else {
          setAnswer(data.transformedText);
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
      setQuestionPrompt('');
      setAnswerPrompt('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Flashcard Oluştur</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="question">Soru *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" disabled={isAILoading}>
                    <Sparkles className="w-4 h-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56">
                  <div className="space-y-2">
                    <h4 className="font-medium text-xs">AI Dönüşüm</h4>
                    <div className="space-y-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-xs h-7"
                        onClick={() => handleAITransform('question', 'grammar')}
                        disabled={isAILoading || !question.trim()}
                      >
                        {isAILoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                        Grameri düzelt
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-xs h-7"
                        onClick={() => handleAITransform('question', 'clarify')}
                        disabled={isAILoading || !question.trim()}
                      >
                        {isAILoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                        Daha anlaşılır
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-xs h-7"
                        onClick={() => handleAITransform('question', 'generate-question')}
                        disabled={isAILoading || !answer.trim()}
                      >
                        {isAILoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                        Otomatik soru
                      </Button>
                      <div className="space-y-1 pt-1 border-t">
                        <Textarea
                          placeholder="Kendi komutunuz..."
                          value={questionPrompt}
                          onChange={(e) => setQuestionPrompt(e.target.value)}
                          className="min-h-[45px] text-xs"
                        />
                        <Button
                          type="button"
                          size="sm"
                          className="w-full text-xs h-7"
                          onClick={() => handleAITransform('question', 'custom')}
                          disabled={isAILoading || !questionPrompt.trim() || !question.trim()}
                        >
                          {isAILoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                          Uygula
                        </Button>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <Input
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Soru..."
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="answer">Cevap *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" disabled={isAILoading}>
                    <Sparkles className="w-4 h-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56">
                  <div className="space-y-2">
                    <h4 className="font-medium text-xs">AI Dönüşüm</h4>
                    <div className="space-y-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-xs h-7"
                        onClick={() => handleAITransform('answer', 'grammar')}
                        disabled={isAILoading || !answer.trim()}
                      >
                        {isAILoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                        Grameri düzelt
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-xs h-7"
                        onClick={() => handleAITransform('answer', 'clarify')}
                        disabled={isAILoading || !answer.trim()}
                      >
                        {isAILoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                        Daha anlaşılır
                      </Button>
                      <div className="space-y-1 pt-1 border-t">
                        <Textarea
                          placeholder="Kendi komutunuz..."
                          value={answerPrompt}
                          onChange={(e) => setAnswerPrompt(e.target.value)}
                          className="min-h-[45px] text-xs"
                        />
                        <Button
                          type="button"
                          size="sm"
                          className="w-full text-xs h-7"
                          onClick={() => handleAITransform('answer', 'custom')}
                          disabled={isAILoading || !answerPrompt.trim() || !answer.trim()}
                        >
                          {isAILoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                          Uygula
                        </Button>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <Textarea
              id="answer"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Cevap..."
              className="min-h-[120px]"
              required
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              İptal
            </Button>
            <Button type="submit" disabled={isLoading || !question.trim() || !answer.trim()}>
              {isLoading ? "Oluşturuluyor..." : "Oluştur"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateFlashcardDialog;
