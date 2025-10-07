import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Plus, Image, Sparkles, Loader2 } from 'lucide-react';
import { extractTextFromPdf } from '@/lib/pdf-ocr';

interface CreateReadingCardDialogProps {
  documentId: string;
  documentContent: string;
  fileUrl?: string;
  onCardCreated: () => void;
}

const CreateReadingCardDialog = ({ documentId, documentContent, fileUrl, onCardCreated }: CreateReadingCardDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAILoading, setIsAILoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    image_url: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.title.trim() || !formData.content.trim()) return;

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
          title: formData.title.trim(),
          content: formData.content.trim(),
          image_url: formData.image_url.trim() || null,
          card_order: nextOrder
        });

      if (error) throw error;

      toast({
        title: "Okuma kartı oluşturuldu",
        description: "Yeni okuma kartı başarıyla eklendi.",
      });

      setFormData({ title: '', content: '', image_url: '' });
      setIsOpen(false);
      onCardCreated();
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

  const handleAIGenerate = async () => {
    if (!user) return;

    setIsAILoading(true);
    try {
      let contentToAnalyze = documentContent;

      if (fileUrl) {
        try {
          const publicUrl = `https://ndfcycalqzjtgwkldafi.supabase.co/storage/v1/object/public/documents/${fileUrl}`;
          const extractedText = await extractTextFromPdf(publicUrl);
          if (extractedText) {
            contentToAnalyze = extractedText;
          }
        } catch (ocrError) {
          console.error('OCR failed, using original content:', ocrError);
        }
      }

      const { data, error } = await supabase.functions.invoke('generate-reading-cards-openai', {
        body: {
          documentContent: contentToAnalyze,
          documentId: documentId,
          userId: user.id
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Kartlar oluşturuldu!",
          description: `${data.cardsCreated} okuma kartı AI tarafından oluşturuldu.`,
        });
        setIsOpen(false);
        onCardCreated();
      }
    } catch (error) {
      console.error('Error generating AI cards:', error);
      toast({
        title: "Hata",
        description: "AI kartları oluşturulurken bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsAILoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Okuma Kartı Oluştur
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Okuma Kartı Oluştur</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="manual" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">
              <Plus className="w-4 h-4 mr-2" />
              Manuel
            </TabsTrigger>
            <TabsTrigger value="ai">
              <Sparkles className="w-4 h-4 mr-2" />
              AI ile Oluştur
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-4 mt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Başlık *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Kart başlığı..."
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="image_url">Görsel URL (İsteğe bağlı)</Label>
                <div className="flex items-center space-x-2">
                  <Image className="w-4 h-4 text-muted-foreground" />
                  <Input
                    id="image_url"
                    type="url"
                    value={formData.image_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">İçerik *</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Okuma kartı içeriği..."
                  className="min-h-[120px]"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  İptal
                </Button>
                <Button type="submit" disabled={isLoading || !formData.title.trim() || !formData.content.trim()}>
                  {isLoading ? "Oluşturuluyor..." : "Oluştur"}
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="ai" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-semibold text-sm mb-2">AI nasıl çalışır?</h4>
                <p className="text-sm text-muted-foreground">
                  AI, belge içeriğinizi analiz ederek otomatik olarak okuma kartları oluşturur. 
                  Metin konusuna ve bütünlüğe göre anlamlı parçalara ayrılır ve her bölüm için bir kart oluşturulur.
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  İptal
                </Button>
                <Button 
                  onClick={handleAIGenerate} 
                  disabled={isAILoading}
                  className="bg-gradient-primary hover:opacity-90"
                >
                  {isAILoading ? (
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
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default CreateReadingCardDialog;