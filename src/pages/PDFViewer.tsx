import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Header from '@/components/Header';
import { useToast } from '@/hooks/use-toast';
import CreateFlashcardDialog from '@/components/CreateFlashcardDialog';
import CreateReadingCardFromSelection from '@/components/CreateReadingCardFromSelection';

const PDFViewer = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [documentId, setDocumentId] = useState<string>('');
  const [documentTitle, setDocumentTitle] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedText, setSelectedText] = useState<string>('');
  const [showFlashcardDialog, setShowFlashcardDialog] = useState(false);
  const [showReadingCardDialog, setShowReadingCardDialog] = useState(false);

  useEffect(() => {
    if (slug) {
      fetchDocument();
    }
  }, [slug]);

  const fetchDocument = async () => {
    if (!slug) return;

    try {
      const { data: docData, error } = await supabase
        .from('documents')
        .select('id, title, file_url, user_id')
        .eq('slug', slug)
        .single();

      if (error || !docData || !docData.file_url) {
        toast({
          title: "Hata",
          description: "Belge bulunamadı veya PDF dosyası yok.",
          variant: "destructive",
        });
        navigate('/documents');
        return;
      }

      setDocumentId(docData.id);
      setDocumentTitle(docData.title);

      // Get signed URL from storage
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from('documents')
        .createSignedUrl(docData.file_url, 3600); // 1 hour

      if (urlError || !signedUrlData) {
        throw new Error('PDF dosyasına erişim sağlanamadı');
      }

      setPdfUrl(signedUrlData.signedUrl);
    } catch (error) {
      console.error('Error fetching document:', error);
      toast({
        title: "Hata",
        description: "Belge yüklenirken bir hata oluştu.",
        variant: "destructive",
      });
      navigate('/documents');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      setSelectedText(selection.toString().trim());
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center h-[80vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <Button 
            onClick={() => navigate(`/document/${slug}`)} 
            variant="ghost" 
            size="sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Belgeye Dön
          </Button>
          <h1 className="text-xl font-semibold text-foreground">{documentTitle}</h1>
          <div className="w-24" />
        </div>

        <div 
          className="bg-card rounded-lg shadow-lg overflow-hidden" 
          style={{ height: 'calc(100vh - 200px)' }}
          onMouseUp={handleTextSelection}
        >
          {pdfUrl && (
            <iframe
              src={`https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(pdfUrl)}`}
              className="w-full h-full border-0"
              title={documentTitle}
            />
          )}
        </div>

        {selectedText && (
          <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-card border border-border rounded-lg shadow-xl p-4 flex items-center gap-3 z-50">
            <p className="text-sm text-muted-foreground max-w-md truncate">
              Seçilen metin: "{selectedText.slice(0, 50)}..."
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowFlashcardDialog(true)}
            >
              Flashcard Oluştur
            </Button>
            <Button
              size="sm"
              onClick={() => setShowReadingCardDialog(true)}
            >
              Okuma Kartı Oluştur
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedText('')}
            >
              ✕
            </Button>
          </div>
        )}

        <CreateFlashcardDialog
          documentId={documentId}
          selectedText={selectedText}
          isOpen={showFlashcardDialog}
          onClose={() => {
            setShowFlashcardDialog(false);
            setSelectedText('');
          }}
        />

        <CreateReadingCardFromSelection
          documentId={documentId}
          selectedText={selectedText}
          isOpen={showReadingCardDialog}
          onClose={() => {
            setShowReadingCardDialog(false);
            setSelectedText('');
          }}
        />
      </div>
    </div>
  );
};

export default PDFViewer;
