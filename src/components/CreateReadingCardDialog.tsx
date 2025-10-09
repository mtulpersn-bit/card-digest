import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useTokenUsage } from '@/hooks/useTokenUsage';
import { Plus, Image, Sparkles, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
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
  const { tokenUsage, refreshTokenUsage } = useTokenUsage(user?.id);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAILoading, setIsAILoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<string>('');
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<'default' | 'structured'>('default');
  const [customPrompt, setCustomPrompt] = useState('');
  const [pageRange, setPageRange] = useState<string>('all');
  const [customPageRange, setCustomPageRange] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    image_url: ''
  });

  const isLimitReached = !tokenUsage.isAdmin && tokenUsage.used >= tokenUsage.limit;

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

    // Check token limit
    if (isLimitReached) {
      setShowLimitDialog(true);
      return;
    }

    setIsAILoading(true);
    setOcrProgress('');
    
    try {
      let contentToAnalyze = '';

      // file_url var mı kontrol et
      if (fileUrl) {
        // PDF varsa OCR ile metne dönüştür
        setOcrProgress('PDF analiz ediliyor...');
        try {
          // Storage'dan signed URL al
          const { data: signedUrlData, error: urlError } = await supabase.storage
            .from('documents')
            .createSignedUrl(fileUrl, 3600); // 1 saat geçerli

          if (urlError || !signedUrlData) {
            throw new Error('PDF dosyasına erişim sağlanamadı');
          }

          const extractedText = await extractTextFromPdf(signedUrlData.signedUrl, (progress) => {
            if (progress.stage === 'loading') {
              setOcrProgress('PDF yükleniyor...');
            } else if (progress.stage === 'render') {
              setOcrProgress(`Sayfa ${progress.page}/${progress.totalPages} render ediliyor...`);
            } else if (progress.stage === 'ocr') {
              const percent = Math.round((progress.progress || 0) * 100);
              setOcrProgress(`Sayfa ${progress.page}/${progress.totalPages} analiz ediliyor... ${percent}%`);
            }
          });
          
          if (extractedText && extractedText.length > 10) {
            contentToAnalyze = extractedText;
            setOcrProgress('PDF başarıyla analiz edildi!');
          } else {
            throw new Error('PDF\'den yeterli metin çıkarılamadı');
          }
        } catch (ocrError) {
          console.error('OCR failed:', ocrError);
          toast({
            title: "PDF Analiz Hatası",
            description: "PDF dosyası analiz edilemedi. Lütfen metin içeren bir PDF yükleyin.",
            variant: "destructive",
          });
          setIsAILoading(false);
          setOcrProgress('');
          return;
        }
      } else if (documentContent && documentContent.trim().length > 10) {
        // file_url null ise content kullan
        contentToAnalyze = documentContent.trim();
        setOcrProgress('Belge içeriği hazırlanıyor...');
      } else {
        // Her ikisi de yoksa hata ver
        toast({
          title: "İçerik Bulunamadı",
          description: "Belge içeriği veya PDF dosyası bulunamadı.",
          variant: "destructive",
        });
        setIsAILoading(false);
        return;
      }

      setOcrProgress('AI kartları oluşturuyor...');

      const finalPageRange = customPageRange.trim() || pageRange;

      const { data, error } = await supabase.functions.invoke('generate-reading-cards-openai', {
        body: {
          documentContent: contentToAnalyze,
          documentId: documentId,
          userId: user.id,
          promptType: customPrompt.trim() ? undefined : selectedPrompt,
          customPrompt: customPrompt.trim() || undefined,
          pageRange: finalPageRange
        }
      });

      if (error) throw error;

      if (data?.limitReached) {
        setShowLimitDialog(true);
        return;
      }

      if (data?.success) {
        toast({
          title: "Kartlar oluşturuldu!",
          description: `${data.cardsCreated} okuma kartı AI tarafından oluşturuldu.`,
        });
        setIsOpen(false);
        setOcrProgress('');
        onCardCreated();
        // Refresh token usage
        await refreshTokenUsage();
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error generating AI cards:', error);
      toast({
        title: "Hata",
        description: error instanceof Error ? error.message : "AI kartları oluşturulurken bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsAILoading(false);
      setOcrProgress('');
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Okuma Kartı Oluştur
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
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
                {isLimitReached && (
                  <div className="bg-destructive/10 border border-destructive/20 p-3 rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-destructive">
                      Günlük token limitiniz doldu. Lütfen yarın tekrar deneyin veya admin kodunu kullanın.
                    </p>
                  </div>
                )}

                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-semibold text-sm mb-2">Prompt Seçimi</h4>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <Card 
                      className={`p-3 cursor-pointer transition-all ${
                        selectedPrompt === 'default' && !customPrompt.trim() 
                          ? 'border-primary bg-primary/5' 
                          : 'hover:border-primary/50'
                      } ${customPrompt.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
                      onClick={() => !customPrompt.trim() && setSelectedPrompt('default')}
                    >
                      <div className="flex items-start gap-2">
                        {selectedPrompt === 'default' && !customPrompt.trim() && (
                          <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        )}
                        <div>
                          <h5 className="font-medium text-sm mb-1">Varsayılan Prompt</h5>
                          <p className="text-xs text-muted-foreground">
                            Metni konusuna göre anlamlı parçalara ayırır, başlık eklemez
                          </p>
                        </div>
                      </div>
                    </Card>

                    <Card 
                      className={`p-3 cursor-pointer transition-all ${
                        selectedPrompt === 'structured' && !customPrompt.trim() 
                          ? 'border-primary bg-primary/5' 
                          : 'hover:border-primary/50'
                      } ${customPrompt.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
                      onClick={() => !customPrompt.trim() && setSelectedPrompt('structured')}
                    >
                      <div className="flex items-start gap-2">
                        {selectedPrompt === 'structured' && !customPrompt.trim() && (
                          <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        )}
                        <div>
                          <h5 className="font-medium text-sm mb-1">Yapılandırılmış Prompt</h5>
                          <p className="text-xs text-muted-foreground">
                            Ana başlık, alt başlık ile kategorize eder
                          </p>
                        </div>
                      </div>
                    </Card>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="customPrompt" className="text-sm">
                      Özel Prompt (Yukarıdaki seçenekler devre dışı kalır)
                    </Label>
                    <Textarea
                      id="customPrompt"
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder="Kendi prompt'unuzu yazın..."
                      className="min-h-[80px] text-sm"
                    />
                  </div>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-semibold text-sm mb-3">Sayfa Aralığı Seçimi</h4>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {['0-3', '4-7', '8-11', '12-15', '16-20', 'all'].map((range) => (
                      <Button
                        key={range}
                        type="button"
                        variant={pageRange === range && !customPageRange.trim() ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          setPageRange(range);
                          setCustomPageRange('');
                        }}
                        disabled={!!customPageRange.trim()}
                      >
                        {range === 'all' ? 'Tüm Sayfalar' : `Sayfa ${range}`}
                      </Button>
                    ))}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="customPageRange" className="text-sm">
                      Özel Sayfa Aralığı (örn: "5-9")
                    </Label>
                    <Input
                      id="customPageRange"
                      value={customPageRange}
                      onChange={(e) => setCustomPageRange(e.target.value)}
                      placeholder="5-9"
                      className="text-sm"
                    />
                  </div>
                </div>

                {ocrProgress && (
                  <div className="bg-primary/10 p-3 rounded-lg">
                    <p className="text-sm text-primary font-medium">{ocrProgress}</p>
                  </div>
                )}

                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                    İptal
                  </Button>
                  <Button 
                    onClick={handleAIGenerate} 
                    disabled={isAILoading || isLimitReached}
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

      <AlertDialog open={showLimitDialog} onOpenChange={setShowLimitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Günlük Token Limiti Aşıldı</AlertDialogTitle>
            <AlertDialogDescription>
              Günlük token limitinize ulaştınız ({tokenUsage.limit} token). 
              Lütfen yarın tekrar deneyin veya profil menüsünden admin kodunu kullanarak sınırsız erişim elde edin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setShowLimitDialog(false)}>
              Tamam
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default CreateReadingCardDialog;
