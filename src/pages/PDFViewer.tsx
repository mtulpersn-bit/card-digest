import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Header from '@/components/Header';
import { useToast } from '@/hooks/use-toast';
import CreateFlashcardDialog from '@/components/CreateFlashcardDialog';
import CreateReadingCardFromSelection from '@/components/CreateReadingCardFromSelection';
import {
  PdfLoader,
  PdfHighlighter,
  Highlight,
  Popup,
  AreaHighlight,
} from 'react-pdf-highlighter';
import type { IHighlight as PDFHighlight } from 'react-pdf-highlighter';

type IHighlight = PDFHighlight;

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
  const [highlights, setHighlights] = useState<IHighlight[]>([]);
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

  const addHighlight = (highlight: IHighlight) => {
    setHighlights([...highlights, highlight]);
  };

  const updateHighlight = (highlightId: string, position: any, content: any) => {
    setHighlights(
      highlights.map((h) => (h.id === highlightId ? { ...h, position, content } : h))
    );
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
        >
          {pdfUrl && (
            <PdfLoader url={pdfUrl} beforeLoad={<div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
              {(pdfDocument) => (
                <PdfHighlighter
                  pdfDocument={pdfDocument}
                  enableAreaSelection={(event) => event.altKey}
                  onScrollChange={() => {}}
                  scrollRef={(scrollTo) => {}}
                  onSelectionFinished={(
                    position,
                    content,
                    hideTipAndSelection,
                    transformSelection
                  ) => (
                    <div className="bg-card border border-border rounded-lg shadow-xl p-3 flex flex-col gap-2">
                      <div className="flex gap-2 items-center">
                        <span className="text-xs text-muted-foreground">Renk:</span>
                        {['#FFFF00', '#FF6B6B', '#4ECDC4', '#95E1D3', '#C7CEEA'].map((color) => (
                          <button
                            key={color}
                            className="w-6 h-6 rounded-full border-2 border-border hover:scale-110 transition-transform"
                            style={{ backgroundColor: color }}
                            onClick={() => setSelectedColor(color)}
                          />
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedText(content.text || '');
                            setShowFlashcardDialog(true);
                            hideTipAndSelection();
                          }}
                        >
                          Flashcard Oluştur
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedText(content.text || '');
                            setShowReadingCardDialog(true);
                            hideTipAndSelection();
                          }}
                        >
                          Okuma Kartı Oluştur
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            const highlight: IHighlight = {
                              id: String(Date.now()),
                              content,
                              position,
                              comment: {
                                text: content.text || '',
                                emoji: '📝',
                              },
                            };
                            addHighlight(highlight);
                            hideTipAndSelection();
                          }}
                          style={{ backgroundColor: selectedColor }}
                        >
                          Vurgula
                        </Button>
                      </div>
                    </div>
                  )}
                  highlightTransform={(
                    highlight,
                    index,
                    setTip,
                    hideTip,
                    viewportToScaled,
                    screenshot,
                    isScrolledTo
                  ) => {
                    const isTextHighlight = !highlight.content?.image;

                    const component = isTextHighlight ? (
                      <Highlight
                        isScrolledTo={isScrolledTo}
                        position={highlight.position}
                        comment={highlight.comment}
                      />
                    ) : (
                      <AreaHighlight
                        isScrolledTo={isScrolledTo}
                        highlight={highlight}
                        onChange={() => {}}
                      />
                    );

                    return (
                      <Popup
                        popupContent={<div />}
                        onMouseOver={(popupContent) =>
                          setTip(highlight, () => popupContent)
                        }
                        onMouseOut={hideTip}
                        key={index}
                      >
                        {component}
                      </Popup>
                    );
                  }}
                  highlights={highlights}
                />
              )}
            </PdfLoader>
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
