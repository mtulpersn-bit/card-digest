import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, BookOpen, Eye, User, Calendar, Bookmark, ThumbsUp, Share2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import Header from '@/components/Header';
import { useToast } from '@/hooks/use-toast';
import CreateReadingCardDialog from '@/components/CreateReadingCardDialog';

interface DocumentData {
  id: string;
  title: string;
  description: string;
  content: string;
  slug: string;
  read_count: number;
  created_at: string;
  user_id: string;
  cover_image?: string;
  file_url?: string;
  profiles: {
    full_name: string;
    username: string;
    avatar_url: string;
  };
  reading_cards: Array<{
    id: string;
    title: string;
    content: string;
    image_url?: string;
    card_order: number;
  }>;
}

const DocumentDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [document, setDocument] = useState<DocumentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savedCards, setSavedCards] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (slug) {
      fetchDocument();
      if (user) {
        fetchSavedCards();
      }
    }
  }, [slug, user]);

  const fetchDocument = async () => {
    if (!slug) return;

    try {
      const { data: docData, error: docError } = await supabase
        .from('documents')
        .select(`
          id,
          title,
          description,
          content,
          slug,
          read_count,
          created_at,
          user_id,
          cover_image,
          file_url,
          reading_cards (
            id,
            title,
            content,
            image_url,
            card_order
          )
        `)
        .eq('slug', slug)
        .single();

      if (docError) {
        console.error('Error fetching document:', docError);
        navigate('/404');
        return;
      }

      // Fetch the author's profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, full_name, username, avatar_url')
        .eq('user_id', docData.user_id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
      }

      const documentWithProfile = {
        ...docData,
        profiles: profile || {
          full_name: 'Anonim Kullanıcı',
          username: 'anonymous',
          avatar_url: null
        },
        reading_cards: docData.reading_cards?.sort((a, b) => a.card_order - b.card_order) || []
      };

      setDocument(documentWithProfile);

      // Increment read count
      if (user?.id !== docData.user_id) {
        await supabase
          .from('documents')
          .update({ read_count: docData.read_count + 1 })
          .eq('id', docData.id);
      }
    } catch (error) {
      console.error('Error fetching document:', error);
      navigate('/404');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSavedCards = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('saved_cards')
        .select('reading_card_id')
        .eq('user_id', user.id);

      if (!error && data) {
        setSavedCards(new Set(data.map(item => item.reading_card_id)));
      }
    } catch (error) {
      console.error('Error fetching saved cards:', error);
    }
  };

  const toggleSaveCard = async (cardId: string) => {
    if (!user) {
      toast({
        title: "Giriş gerekli",
        description: "Kartları kaydetmek için giriş yapmalısınız.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (savedCards.has(cardId)) {
        const { error } = await supabase
          .from('saved_cards')
          .delete()
          .eq('user_id', user.id)
          .eq('reading_card_id', cardId);

        if (error) throw error;

        setSavedCards(prev => {
          const newSet = new Set(prev);
          newSet.delete(cardId);
          return newSet;
        });

        toast({
          title: "Kart kaydedilenlenden çıkarıldı",
          description: "Kart artık kaydedilenler listenizde bulunmuyor.",
        });
      } else {
        const { error } = await supabase
          .from('saved_cards')
          .insert({
            user_id: user.id,
            reading_card_id: cardId
          });

        if (error) throw error;

        setSavedCards(prev => new Set([...prev, cardId]));

        toast({
          title: "Kart kaydedildi",
          description: "Kart kaydedilenler listenize eklendi.",
        });
      }
    } catch (error) {
      console.error('Error toggling save card:', error);
      toast({
        title: "Hata",
        description: "Kart kaydedilirken bir hata oluştu.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="animate-pulse space-y-6">
              <div className="h-8 bg-muted rounded w-1/4" />
              <div className="h-12 bg-muted rounded w-3/4" />
              <div className="h-4 bg-muted rounded w-1/2" />
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-32 bg-muted rounded" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-2xl font-bold text-foreground mb-4">Belge bulunamadı</h1>
            <Button onClick={() => navigate('/documents')} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Belgelere Dön
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Back Button */}
          <Button 
            onClick={() => navigate('/documents')} 
            variant="ghost" 
            className="mb-6 -ml-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Belgelere Dön
          </Button>

          {/* Document Header */}
          <div className="mb-8">
            <div className="flex items-center space-x-4 mb-6">
              <Avatar className="h-12 w-12 border-2 border-primary/20">
                <AvatarImage src={document.profiles?.avatar_url} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  <User className="w-6 h-6" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium text-foreground">
                  {document.profiles?.full_name || 'Anonim Kullanıcı'}
                </p>
                <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                  <div className="flex items-center space-x-1">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {formatDistanceToNow(new Date(document.created_at), { 
                        addSuffix: true, 
                        locale: tr 
                      })}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Eye className="w-4 h-4" />
                    <span>{document.read_count} okunma</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <BookOpen className="w-4 h-4" />
                    <span>{document.reading_cards.length} okuma kartı</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-foreground mb-4">{document.title}</h1>
                
                {document.description && (
                  <p className="text-lg text-muted-foreground">{document.description}</p>
                )}
              </div>
              
              {user?.id === document.user_id && (
                <div className="ml-6 space-y-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4 mr-2" />
                        Belgeyi Görüntüle
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>{document.title}</DialogTitle>
                      </DialogHeader>
                      <div className="mt-4">
                        {document.file_url ? (
                          <iframe
                            src={`https://mprwhgypstsjojmmzubz.supabase.co/storage/v1/object/public/documents/${document.file_url}`}
                            className="w-full h-[70vh] border rounded-lg"
                            title={document.title}
                          />
                        ) : (
                          <div className="prose prose-slate max-w-none">
                            <p className="whitespace-pre-wrap text-foreground leading-relaxed">
                              {document.content}
                            </p>
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                  <CreateReadingCardDialog
                    documentId={document.id}
                    onCardCreated={fetchDocument}
                  />
                </div>
              )}
            </div>
          </div>


          {/* Reading Cards */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-foreground flex items-center space-x-2">
              <BookOpen className="w-6 h-6" />
              <span>Okuma Kartları</span>
              <Badge variant="secondary">{document.reading_cards.length}</Badge>
            </h2>

            {document.reading_cards.length === 0 ? (
              <Card className="bg-gradient-card border-0">
                <CardContent className="text-center py-12">
                  <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Henüz okuma kartı yok
                  </h3>
                  <p className="text-muted-foreground">
                    Bu belge için henüz okuma kartı oluşturulmamış.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {document.reading_cards.map((card, index) => (
                  <Card key={card.id} className="bg-gradient-card border-0 hover:shadow-medium transition-all duration-300 overflow-hidden">
                    <CardContent className="pb-4">
                      {card.image_url ? (
                        <div className="flex flex-col lg:flex-row gap-6 mb-6">
                          <div className="lg:w-1/3 flex-shrink-0">
                            <img 
                              src={card.image_url} 
                              alt={card.title}
                              className="w-full h-48 lg:h-64 object-cover rounded-lg shadow-lg"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                          <div className="lg:w-2/3">
                            <CardTitle className="text-2xl font-bold text-foreground flex items-center space-x-3 mb-4">
                              <span className="w-10 h-10 bg-primary/15 text-primary rounded-full flex items-center justify-center text-lg font-bold">
                                {index + 1}
                              </span>
                              <span className="leading-tight">{card.title}</span>
                            </CardTitle>
                            <div className="prose prose-slate max-w-none">
                              <p className="whitespace-pre-wrap text-foreground text-lg leading-relaxed font-medium">
                                {card.content}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mb-6">
                          <CardTitle className="text-2xl font-bold text-foreground flex items-center space-x-3 mb-4">
                            <span className="w-10 h-10 bg-primary/15 text-primary rounded-full flex items-center justify-center text-lg font-bold">
                              {index + 1}
                            </span>
                            <span className="leading-tight">{card.title}</span>
                          </CardTitle>
                          <div className="prose prose-slate max-w-none">
                            <p className="whitespace-pre-wrap text-foreground text-lg leading-relaxed font-medium">
                              {card.content}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {/* Action buttons */}
                      <div className="flex items-center justify-between pt-4 border-t border-border/50">
                        <div className="flex items-center space-x-4">
                          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
                            <ThumbsUp className="w-4 h-4 mr-2" />
                            Beğen
                          </Button>
                          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
                            <Share2 className="w-4 h-4 mr-2" />
                            Paylaş
                          </Button>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSaveCard(card.id)}
                          className={`hover:bg-primary/10 ${savedCards.has(card.id) ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
                        >
                          <Bookmark className={`w-4 h-4 mr-2 ${savedCards.has(card.id) ? 'fill-current' : ''}`} />
                          {savedCards.has(card.id) ? 'Kaydedildi' : 'Kaydet'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default DocumentDetail;