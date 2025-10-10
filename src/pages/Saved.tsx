import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { BookOpen, User, BookmarkX, ExternalLink, Bookmark, ThumbsUp, Share2 } from 'lucide-react';
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
    image_url?: string;
    created_at: string;
    document_id: string;
    user_id: string;
    profiles: {
      display_name: string;
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
  const [likedCards, setLikedCards] = useState<Set<string>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchSavedCards();
    if (user) {
      fetchLikedCards();
    }
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
            image_url,
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
        .select('id, display_name, avatar_url')
        .in('id', cardUserIds);

      // Combine saved cards with profiles
      const savedCardsWithProfiles = data?.map(savedCard => ({
        ...savedCard,
        reading_cards: {
          ...savedCard.reading_cards,
          profiles: cardProfiles?.find(p => p.id === savedCard.reading_cards.user_id) || {
            display_name: 'Anonim Kullanıcı',
            avatar_url: null
          }
        }
      })) || [];

      setSavedCards(savedCardsWithProfiles);

      // Fetch like counts
      if (data && data.length > 0) {
        const cardIds = data.map(item => item.reading_cards.id);
        const { data: likesData } = await supabase
          .from('reading_card_likes')
          .select('reading_card_id')
          .in('reading_card_id', cardIds);

        const counts: Record<string, number> = {};
        likesData?.forEach((like) => {
          counts[like.reading_card_id] = (counts[like.reading_card_id] || 0) + 1;
        });
        setLikeCounts(counts);
      }
    } catch (error) {
      console.error('Error fetching saved cards:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLikedCards = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('reading_card_likes')
        .select('reading_card_id')
        .eq('user_id', user.id);

      if (!error && data) {
        setLikedCards(new Set(data.map(item => item.reading_card_id)));
      }
    } catch (error) {
      console.error('Error fetching liked cards:', error);
    }
  };

  const toggleLikeCard = async (cardId: string) => {
    if (!user) {
      toast({
        title: "Giriş gerekli",
        description: "Kartları beğenmek için giriş yapmalısınız.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (likedCards.has(cardId)) {
        const { error } = await supabase
          .from('reading_card_likes')
          .delete()
          .eq('user_id', user.id)
          .eq('reading_card_id', cardId);

        if (error) throw error;

        setLikedCards(prev => {
          const newSet = new Set(prev);
          newSet.delete(cardId);
          return newSet;
        });

        setLikeCounts(prev => ({
          ...prev,
          [cardId]: Math.max(0, (prev[cardId] || 0) - 1)
        }));
      } else {
        const { error } = await supabase
          .from('reading_card_likes')
          .insert({
            user_id: user.id,
            reading_card_id: cardId
          });

        if (error) throw error;

        setLikedCards(prev => new Set([...prev, cardId]));

        setLikeCounts(prev => ({
          ...prev,
          [cardId]: (prev[cardId] || 0) + 1
        }));
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      toast({
        title: "Hata",
        description: "Beğeni işlemi sırasında bir hata oluştu.",
        variant: "destructive",
      });
    }
  };

  const handleShare = async (cardId: string, cardTitle: string) => {
    const card = savedCards.find(sc => sc.reading_cards.id === cardId);
    if (!card) return;

    const url = `${window.location.origin}/document/${card.reading_cards.documents?.slug}#card-${cardId}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: cardTitle,
          url: url,
        });
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          copyToClipboard(url);
        }
      }
    } else {
      copyToClipboard(url);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Bağlantı kopyalandı",
      description: "Kart bağlantısı panoya kopyalandı.",
    });
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
                  {card.profiles?.display_name || 'Anonim Kullanıcı'}
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
          {card.image_url ? (
            <div className="flex flex-col lg:flex-row gap-4 mb-4">
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
                <CardTitle className="text-lg font-semibold text-foreground mb-2">
                  {card.title}
                </CardTitle>
                <CardDescription className="text-foreground leading-relaxed">
                  {card.content}
                </CardDescription>
              </div>
            </div>
          ) : (
            <div>
              <CardTitle className="text-lg font-semibold text-foreground mb-2">
                {card.title}
              </CardTitle>
              <CardDescription className="text-foreground leading-relaxed">
                {card.content}
              </CardDescription>
            </div>
          )}
          
          <div className="flex items-center justify-between pt-4 border-t border-border/50">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="sm" 
                className={`${likedCards.has(card.id) ? 'text-primary' : 'text-muted-foreground'} hover:text-primary`}
                onClick={() => toggleLikeCard(card.id)}
              >
                <ThumbsUp className={`w-4 h-4 mr-2 ${likedCards.has(card.id) ? 'fill-current' : ''}`} />
                Beğen {likeCounts[card.id] ? `(${likeCounts[card.id]})` : ''}
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-muted-foreground hover:text-primary"
                onClick={() => handleShare(card.id, card.title)}
              >
                <Share2 className="w-4 h-4 mr-2" />
                Paylaş
              </Button>
            </div>
            <div className="flex items-center space-x-2">
              <Link 
                to={`/document/${card.documents?.slug}`}
                className="text-sm text-primary hover:text-primary-hover font-medium"
              >
                {card.documents?.title}
              </Link>
              <Badge variant="secondary" className="text-xs">
                Kart {/* Card number removed */}
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