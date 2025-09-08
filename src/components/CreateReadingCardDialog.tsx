import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Plus, Image } from 'lucide-react';

interface CreateReadingCardDialogProps {
  documentId: string;
  onCardCreated: () => void;
}

const CreateReadingCardDialog = ({ documentId, onCardCreated }: CreateReadingCardDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    highlight_text: '',
    image_url: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.title.trim() || !formData.content.trim()) return;

    setIsLoading(true);
    try {
      // Get the current max card_order for this document
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
          highlight_text: formData.highlight_text.trim() || null,
          image_url: formData.image_url.trim() || null,
          card_order: nextOrder
        });

      if (error) throw error;

      toast({
        title: "Okuma kartı oluşturuldu",
        description: "Yeni okuma kartı başarıyla eklendi.",
      });

      setFormData({ title: '', content: '', highlight_text: '', image_url: '' });
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
          <DialogTitle>Yeni Okuma Kartı</DialogTitle>
        </DialogHeader>
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
            <Label htmlFor="highlight_text">Vurgulu Metin (İsteğe bağlı)</Label>
            <Input
              id="highlight_text"
              value={formData.highlight_text}
              onChange={(e) => setFormData(prev => ({ ...prev, highlight_text: e.target.value }))}
              placeholder="Belgeden alıntı veya vurgulu metin..."
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
      </DialogContent>
    </Dialog>
  );
};

export default CreateReadingCardDialog;