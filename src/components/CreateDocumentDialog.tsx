import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { FileText, Upload, Loader2, Globe, Lock } from 'lucide-react';

interface CreateDocumentDialogProps {
  onClose: () => void;
}

const CreateDocumentDialog = ({ onClose }: CreateDocumentDialogProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleManualCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim() || !content.trim()) return;

    setIsLoading(true);
    try {
      const { data: slugData, error: slugError } = await supabase
        .rpc('generate_unique_slug', { input_title: title });

      if (slugError) throw slugError;

      const { data, error } = await supabase
        .from('documents')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          content: content.trim(),
          slug: slugData,
          user_id: user.id,
          is_public: isPublic,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Belge oluşturuldu!",
        description: isPublic ? "Belgeniz herkese açık olarak oluşturuldu." : "Belgeniz kişisel olarak oluşturuldu.",
      });

      onClose();
      navigate(`/document/${data.slug}`);
    } catch (error: any) {
      console.error('Error creating document:', error);
      toast({
        title: "Hata",
        description: error.message || "Belge oluşturulurken bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !file || !title.trim()) return;

    setIsLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: slugData, error: slugError } = await supabase
        .rpc('generate_unique_slug', { input_title: title });

      if (slugError) throw slugError;

      const { data, error } = await supabase
        .from('documents')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          content: `PDF Dosyası: ${file.name}`,
          file_url: uploadData.path,
          slug: slugData,
          user_id: user.id,
          is_public: isPublic,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "PDF yüklendi!",
        description: isPublic ? "PDF dosyanız herkese açık olarak yüklendi." : "PDF dosyanız kişisel olarak yüklendi.",
      });

      onClose();
      navigate(`/document/${data.slug}`);
    } catch (error: any) {
      console.error('Error uploading PDF:', error);
      toast({
        title: "Hata",
        description: error.message || "PDF yüklenirken bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Tabs defaultValue="manual" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="manual" className="flex items-center space-x-2">
          <FileText className="w-4 h-4" />
          <span>Belge Oluştur</span>
        </TabsTrigger>
        <TabsTrigger value="upload" className="flex items-center space-x-2">
          <Upload className="w-4 h-4" />
          <span>PDF Yükle</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="manual" className="space-y-4 mt-6">
        <form onSubmit={handleManualCreate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Belge Başlığı *</Label>
            <Input
              id="title"
              placeholder="Belgenizin başlığını girin"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Açıklama</Label>
            <Input
              id="description"
              placeholder="Belgenizin kısa açıklaması (isteğe bağlı)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="content">İçerik *</Label>
            <Textarea
              id="content"
              placeholder="Belgenizin içeriğini yazın..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              required
            />
          </div>

          {/* Visibility Toggle */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
            <div className="flex items-center space-x-3">
              {isPublic ? (
                <Globe className="w-5 h-5 text-primary" />
              ) : (
                <Lock className="w-5 h-5 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium text-foreground">
                  {isPublic ? 'Ağ Modu' : 'Kişisel Mod'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isPublic 
                    ? 'Tüm kullanıcılar bu belgeyi görebilir' 
                    : 'Sadece siz bu belgeyi görebilirsiniz'}
                </p>
              </div>
            </div>
            <Switch
              checked={isPublic}
              onCheckedChange={setIsPublic}
            />
          </div>
          
          <div className="flex space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              İptal
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading || !title.trim() || !content.trim()}
              className="flex-1 bg-gradient-primary hover:opacity-90"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Oluşturuluyor...
                </>
              ) : (
                'Belge Oluştur'
              )}
            </Button>
          </div>
        </form>
      </TabsContent>

      <TabsContent value="upload" className="space-y-4 mt-6">
        <form onSubmit={handleFileUpload} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="upload-title">Belge Başlığı *</Label>
            <Input
              id="upload-title"
              placeholder="PDF için bir başlık girin"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="upload-description">Açıklama</Label>
            <Input
              id="upload-description"
              placeholder="PDF'in kısa açıklaması (isteğe bağlı)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="file">PDF Dosyası *</Label>
            <Input
              id="file"
              type="file"
              accept=".pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Maksimum dosya boyutu: 10MB
            </p>
          </div>

          {/* Visibility Toggle */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
            <div className="flex items-center space-x-3">
              {isPublic ? (
                <Globe className="w-5 h-5 text-primary" />
              ) : (
                <Lock className="w-5 h-5 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium text-foreground">
                  {isPublic ? 'Ağ Modu' : 'Kişisel Mod'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isPublic 
                    ? 'Tüm kullanıcılar bu belgeyi görebilir' 
                    : 'Sadece siz bu belgeyi görebilirsiniz'}
                </p>
              </div>
            </div>
            <Switch
              checked={isPublic}
              onCheckedChange={setIsPublic}
            />
          </div>
          
          <div className="flex space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              İptal
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading || !title.trim() || !file}
              className="flex-1 bg-gradient-primary hover:opacity-90"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Yükleniyor...
                </>
              ) : (
                'PDF Yükle'
              )}
            </Button>
          </div>
        </form>
      </TabsContent>
    </Tabs>
  );
};

export default CreateDocumentDialog;