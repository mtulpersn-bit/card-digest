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
import { Viewer, Worker, SpecialZoomLevel } from '@react-pdf-viewer/core';
import { highlightPlugin, Trigger, type HighlightArea, type RenderHighlightTargetProps } from '@react-pdf-viewer/highlight';
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/highlight/lib/styles/index.css';

// Use the matching pdfjs-dist version installed in the project
const PDF_WORKER_URL = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

type ColoredArea = HighlightArea & { id: string; color: string };

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
  const [highlightAreas, setHighlightAreas] = useState<ColoredArea[]>([]);
  const [selectedColor, setSelectedColor] = useState<string>('#FFFF00');

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
          title: 'Hata',
          description: 'Belge bulunamadı veya PDF dosyası yok.',
          variant: 'destructive',
        });
        navigate('/documents');
        return;
      }

      setDocumentId(docData.id);
      setDocumentTitle(docData.title);

      // Get signed URL from storage (bucket should be public for general access)
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
        title: 'Hata',
        description: 'Belge yüklenirken bir hata oluştu.',
        variant: 'destructive',
      });
      navigate('/documents');
    } finally {
      setIsLoading(false);
    }
  };

  const renderHighlightTarget = (props: RenderHighlightTargetProps) => {
    return (
      <div
        style={{
          background: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          borderRadius: '6px',
          padding: '8px',
          position: 'absolute',
          left: `${props.selectionRegion.left}%`,
          top: `${props.selectionRegion.top + props.selectionRegion.height}%`,
          zIndex: 9999,
          minWidth: '200px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        }}
      >
        <div style={{ display: 'flex', gap: '4px' }}>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedText(props.selectedText || '');
              setShowFlashcardDialog(true);
              props.cancel();
            }}
            className="flex-1 h-7 text-xs px-2"
          >
            Flashcard
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedText(props.selectedText || '');
              setShowReadingCardDialog(true);
              props.cancel();
            }}
            className="flex-1 h-7 text-xs px-2"
          >
            Okuma Kartı
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              const newAreas = props.highlightAreas.map((a, idx) => ({
                ...a,
                id: `${Date.now()}-${idx}`,
                color: selectedColor,
              }));
              setHighlightAreas((prev) => [...prev, ...newAreas]);
              props.cancel();
            }}
            className="flex-1 h-7 text-xs px-2"
          >
            Vurgula
          </Button>
        </div>
      </div>
    );
  };

  const highlightPluginInstance = highlightPlugin({
    trigger: Trigger.TextSelection,
    renderHighlightTarget,
    renderHighlights: ({ pageIndex, rotation, getCssProperties }) => (
      <>
        {highlightAreas
          .filter((area) => area.pageIndex === pageIndex)
          .map((area) => (
            <div
              key={area.id}
              style={{
                ...getCssProperties(area, rotation),
                background: area.color,
                opacity: 0.35,
                borderRadius: 4,
              }}
            />
          ))}
      </>
    ),
  });

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
          <Button onClick={() => navigate(`/document/${slug}`)} variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Belgeye Dön
          </Button>
          <h1 className="text-xl font-semibold text-foreground">{documentTitle}</h1>
          <div className="w-24" />
        </div>

        <div
          className="bg-card rounded-lg shadow-lg overflow-hidden"
          style={{ height: 'calc(100vh - 200px)' }}
        >
          {pdfUrl ? (
            <Worker workerUrl={PDF_WORKER_URL}>
              <div className="h-full">
                <Viewer
                  fileUrl={pdfUrl}
                  plugins={[highlightPluginInstance]}
                  defaultScale={SpecialZoomLevel.PageWidth}
                />
              </div>
            </Worker>
          ) : (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}
        </div>

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
