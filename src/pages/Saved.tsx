import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { BookOpen, User, BookmarkX, ExternalLink, Bookmark } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useToast } from '@/components/ui/use-toast';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';

interface SavedCard {
  id: string;
  created_at: string;
  reading_cards: {
    id: string;
    title: string;
    content: string;
    highlight_text: string | null;
    created_at: string;
    document_id: string;
    profiles: {
      full_name: string;
      username: string;
      avatar_url: string;
    };
    documents: {
      title: string;
      slug: string;
    };
  };
}

const Saved = () => {
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchSavedCards();
  }, [user]);

  const fetchSavedCards = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('saved_cards')
        .select(`
          id,
          created_at,
          reading_cards (
            id,
            title,
            content,
            highlight_text,
            created_at,
            document_id,
            user_id,
            documents (
              title,
              slug
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles for the reading cards
      const cardUserIds = [...new Set(data?.map(item => item.reading_cards.user_id) || [])];
      const { data: cardProfiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, username, avatar_url')
        .in('user_id', cardUserIds);

      // Combine saved cards with profiles
      const savedCardsWithProfiles = data?.map(savedCard => ({
        ...savedCard,
        reading_cards: {
          ...savedCard.reading_cards,
          profiles: cardProfiles?.find(p => p.user_id === savedCard.reading_cards.user_id) || {
            full_name: 'Anonim Kullanıcı',
            username: 'anonymous',
            avatar_url: null
          }
        }
      })) || [];

      setSavedCards(savedCardsWithProfiles);
    } catch (error) {
      console.error('Error fetching saved cards:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const unsaveCard = async (savedCardId: string, readingCardId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('saved_cards')
        .delete()
        .eq('id', savedCardId);

      if (error) throw error;

      // Update local state
      setSavedCards(prev => prev.filter(card => card.id !== savedCardId));

      toast({
        title: "Kart kaldırıldı",
        description: "Okuma kartı kaydedilenlerden kaldırıldı.",
      });
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message || "Bir hata oluştu.",
        variant: "destructive",
      });
    }
  };

  const SavedCardComponent = ({ savedCard }: { savedCard: SavedCard }) => {
    const card = savedCard.reading_cards;

    return (
      <Card className="group hover:shadow-medium transition-all duration-300 bg-gradient-card border-0">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Avatar className="h-10 w-10 border-2 border-primary/20">
                <AvatarImage src={card.profiles?.avatar_url} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  <User className="w-5 h-5" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {card.profiles?.full_name || 'Anonim Kullanıcı'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Kaydedildi: {formatDistanceToNow(new Date(savedCard.created_at), { 
                    addSuffix: true, 
                    locale: tr 
                  })}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => unsaveCard(savedCard.id, card.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <BookmarkX className="w-4 h-4" />
              </Button>
              
              <Button variant="ghost" size="sm" asChild>
                <Link to={`/document/${card.documents?.slug}`}>
                  <ExternalLink className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div>
            <CardTitle className="text-lg font-semibold text-foreground mb-2">
              {card.title}
            </CardTitle>
            
            {card.highlight_text && (
              <div className="bg-accent/50 border-l-4 border-accent pl-4 py-2 mb-3">
                <p className="text-sm italic text-accent-foreground">
                  "{card.highlight_text}"
                </p>
              </div>
            )}
            
            <CardDescription className="text-foreground leading-relaxed">
              {card.content}
            </CardDescription>
          </div>
          
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <Link 
              to={`/document/${card.documents?.slug}`}
              className="text-sm text-primary hover:text-primary-hover font-medium"
            >
              {card.documents?.title}
            </Link>
            
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="text-xs">
                Okuma Kartı
              </Badge>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(card.created_at), { 
                  addSuffix: true, 
                  locale: tr 
                })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-muted-foreground">Giriş yapmanız gerekiyor.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Kaydedilenler</h1>
            <p className="text-muted-foreground">
              Kaydettiğiniz okuma kartlarınızı buradan takip edin
            </p>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-muted rounded-full" />
                      <div className="space-y-2 flex-1">
                        <div className="h-4 bg-muted rounded w-1/4" />
                        <div className="h-3 bg-muted rounded w-1/6" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="h-6 bg-muted rounded w-3/4" />
                      <div className="h-4 bg-muted rounded w-full" />
                      <div className="h-4 bg-muted rounded w-5/6" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : savedCards.length === 0 ? (
            <div className="text-center py-12">
              <Bookmark className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Henüz hiç kart kaydetmemişsiniz
              </h3>
              <p className="text-muted-foreground mb-4">
                Beğendiğiniz okuma kartlarını kaydedin ve daha sonra kolayca erişin.
              </p>
              <Button asChild className="bg-gradient-primary hover:opacity-90">
                <Link to="/timeline">Okuma Kartlarını Keşfet</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-sm">
                  {savedCards.length} kayıtlı kart
                </Badge>
              </div>
              
              {savedCards.map((savedCard) => (
                <SavedCardComponent key={savedCard.id} savedCard={savedCard} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Saved;