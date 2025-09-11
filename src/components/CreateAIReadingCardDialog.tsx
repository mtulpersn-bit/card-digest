import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Sparkles, Loader2 } from 'lucide-react';

interface CreateAIReadingCardDialogProps {
  documentId: string;
  documentContent?: string;
  fileUrl?: string;
  onCardCreated: () => void;
}

const CreateAIReadingCardDialog = ({ 
  documentId, 
  documentContent, 
  fileUrl, 
  onCardCreated 
}: CreateAIReadingCardDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [inputContent, setInputContent] = useState('');
  const [userPrompt, setUserPrompt] = useState('');
  const isPDFPlaceholder = !!fileUrl && (!documentContent || documentContent.trim().toLowerCase().startsWith('pdf dosyası'));

  const handleCreateAICards = async () => {
    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-ai-reading-cards', {
        body: {
          documentId,
          documentContent: isPDFPlaceholder ? inputContent : documentContent,
          fileUrl,
          userPrompt
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Başarılı!",
          description: data.message,
        });
        setOpen(false);
        onCardCreated();
      } else {
        throw new Error(data.error || 'Okuma kartları oluşturulamadı');
      }
    } catch (error) {
      console.error('Error creating AI reading cards:', error);
      toast({
        title: "Hata",
        description: error.message || "AI okuma kartları oluşturulurken bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="ml-2">
          <Sparkles className="w-4 h-4 mr-2" />
          AI ile Okuma Kartı Oluştur
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <span>AI ile Okuma Kartı Oluştur</span>
          </DialogTitle>
          <DialogDescription>
            AI, belgenizin içeriğini analiz ederek otomatik olarak okuma kartları oluşturacak. 
            İçerik orijinal haliyle korunarak, konu başlıklarına göre mantıklı parçalara bölünecek.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="font-medium text-sm mb-2">AI Nasıl Çalışır?</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Metninizi analiz eder</li>
              <li>• Konu başlıklarına göre böler</li>
              <li>• Orijinal kelimeleri korur</li>
              <li>• Timeline akışına uygun kartlar oluşturur</li>
            </ul>
          </div>

          {isPDFPlaceholder && (
            <div className="space-y-3">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Not:</strong> Bu belge bir PDF. Şimdilik otomatik metin çıkarma yok. Lütfen analiz edilecek metni aşağıya yapıştırın.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-content">Analiz edilecek metin</Label>
                <Textarea
                  id="ai-content"
                  placeholder="PDF içeriğinden metni yapıştırın..."
                  value={inputContent}
                  onChange={(e) => setInputContent(e.target.value)}
                  rows={8}
                />
              </div>
            </div>
          )}


          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ai-prompt">Ek talimatlar (opsiyonel)</Label>
              <Textarea
                id="ai-prompt"
                placeholder="Örn: Başlıklarda kısa cümleler kullan, kartları 5-7 cümleyi geçirme..."
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                rows={4}
              />
            </div>

            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                İptal
              </Button>
              <Button
                onClick={handleCreateAICards}
                disabled={loading || (isPDFPlaceholder && !inputContent?.trim())}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Oluşturuluyor...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    AI ile Oluştur
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateAIReadingCardDialog;