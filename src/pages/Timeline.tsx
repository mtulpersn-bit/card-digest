import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { BookOpen, User, Bookmark, BookmarkCheck, ExternalLink, ThumbsUp, Share2, Globe, GlobeLock, Trash2, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useToast } from '@/components/ui/use-toast';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';

interface ReadingCard {
  id: string;
  title: string;
  content: string;
  image_url?: string;
  created_at: string;
  document_id: string;
  user_id: string;
  is_public: boolean;
  profiles: {
    display_name: string;
    avatar_url: string;
  };
  documents: {
    title: string;
    slug: string;
  };
  saved_cards?: Array<{ id: string }>;
}

const Timeline = () => {
  const [networkCards, setNetworkCards] = useState<ReadingCard[]>([]);
  const [personalCards, setPersonalCards] = useState<ReadingCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [likedCards, setLikedCards] = useState<Set<string>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [cardVisibilityLoading, setCardVisibilityLoading] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchReadingCards();
    if (user) {
      fetchLikedCards();
    }
  }, [user]);

  const fetchReadingCards = async () => {
    if (!user) return;

    try {
      // Fetch network cards (public cards from public documents)
      const { data: allCards, error: allError } = await supabase
        .from('reading_cards')
        .select(`
          id,
          title,
          content,
          image_url,
          created_at,
          document_id,
          user_id,
          is_public,
          documents (
            title,
            slug,
            is_public
          ),
          saved_cards!left (
            id
          )
        `)
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (allError) throw allError;

      // Filter to only show cards from public documents
      const publicCards = allCards?.filter(card => card.documents?.is_public) || [];

      // Fetch profiles for the cards
      const cardUserIds = [...new Set(publicCards.map(card => card.user_id))];
      const { data: cardProfiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', cardUserIds);

      const cardsWithProfiles = publicCards.map(card => ({
        ...card,
        profiles: cardProfiles?.find(p => p.id === card.user_id) || {
          display_name: 'Anonim Kullanıcı',
          avatar_url: null
        }
      }));

      // Fetch personal reading cards (all cards by the user)
      const { data: personalCardsData, error: personalError } = await supabase
        .from('reading_cards')
        .select(`
          id,
          title,
          content,
          image_url,
          created_at,
          document_id,
          user_id,
          is_public,
          documents (
            title,
            slug
          ),
          saved_cards!left (
            id
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (personalError) throw personalError;

      const { data: userProfile } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .eq('id', user.id)
        .single();

      const personalCardsWithProfile = personalCardsData?.map(card => ({
        ...card,
        profiles: userProfile || {
          display_name: 'Anonim Kullanıcı',
          avatar_url: null
        }
      })) || [];

      // Fetch like counts for all cards
      const allCardIds = [...cardsWithProfiles, ...personalCardsWithProfile].map(c => c.id);
      if (allCardIds.length > 0) {
        const { data: likesData } = await supabase
          .from('reading_card_likes')
          .select('reading_card_id')
          .in('reading_card_id', allCardIds);

        const counts: Record<string, number> = {};
        likesData?.forEach((like) => {
          counts[like.reading_card_id] = (counts[like.reading_card_id] || 0) + 1;
        });
        setLikeCounts(counts);
      }

      setNetworkCards(cardsWithProfiles);
      setPersonalCards(personalCardsWithProfile);
    } catch (error) {
      console.error('Error fetching reading cards:', error);
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
    if (!user) return;

    try {
      if (likedCards.has(cardId)) {
        await supabase
          .from('reading_card_likes')
          .delete()
          .eq('user_id', user.id)
          .eq('reading_card_id', cardId);

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
        await supabase
          .from('reading_card_likes')
          .insert({
            user_id: user.id,
            reading_card_id: cardId
          });

        setLikedCards(prev => new Set([...prev, cardId]));

        setLikeCounts(prev => ({
          ...prev,
          [cardId]: (prev[cardId] || 0) + 1
        }));
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleShare = async (card: ReadingCard) => {
    const url = `${window.location.origin}/document/${card.documents?.slug}#card-${card.id}`;
    const shareText = `${card.title}\n\n${card.content}\n\n${url}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: card.title,
          text: card.content,
          url: url,
        });
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          navigator.clipboard.writeText(shareText);
          toast({
            title: "İçerik kopyalandı",
            description: "Kart içeriği panoya kopyalandı.",
          });
        }
      }
    } else {
      navigator.clipboard.writeText(shareText);
      toast({
        title: "İçerik kopyalandı",
        description: "Kart içeriği panoya kopyalandı.",
      });
    }
  };

  const toggleCardVisibility = async (cardId: string, currentIsPublic: boolean) => {
    if (!user) return;

    setCardVisibilityLoading(cardId);
    try {
      const { error } = await supabase
        .from('reading_cards')
        .update({ is_public: !currentIsPublic })
        .eq('id', cardId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: currentIsPublic ? "Kart kişisel yapıldı" : "Kart ağda paylaşıldı",
        description: currentIsPublic 
          ? "Bu kart artık sadece size görünür." 
          : "Bu kart artık ağda herkese görünür.",
      });

      fetchReadingCards();
    } catch (error) {
      console.error('Error toggling card visibility:', error);
      toast({
        title: "Hata",
        description: "Kart görünürlüğü değiştirilirken bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setCardVisibilityLoading(null);
    }
  };

  const deleteCard = async (cardId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('reading_cards')
        .delete()
        .eq('id', cardId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Kart silindi",
        description: "Okuma kartı başarıyla silindi.",
      });

      fetchReadingCards();
    } catch (error) {
      console.error('Error deleting card:', error);
      toast({
        title: "Hata",
        description: "Kart silinirken bir hata oluştu.",
        variant: "destructive",
      });
    }
  };

  const toggleSaveCard = async (cardId: string, isSaved: boolean) => {
    if (!user) return;

    try {
      if (isSaved) {
        const { error } = await supabase
          .from('saved_cards')
          .delete()
          .eq('user_id', user.id)
          .eq('reading_card_id', cardId);

        if (error) throw error;

        toast({
          title: "Kart kaldırıldı",
          description: "Okuma kartı kaydedilenlerden kaldırıldı.",
        });
      } else {
        const { error } = await supabase
          .from('saved_cards')
          .insert({
            user_id: user.id,
            reading_card_id: cardId,
          });

        if (error) throw error;

        toast({
          title: "Kart kaydedildi",
          description: "Okuma kartı kaydedilenlere eklendi.",
        });
      }

      fetchReadingCards();
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message || "Bir hata oluştu.",
        variant: "destructive",
      });
    }
  };

  const ReadingCardComponent = ({ card, showOwnerActions = false }: { card: ReadingCard; showOwnerActions?: boolean }) => {
    const isSaved = card.saved_cards && card.saved_cards.length > 0;
    const isOwner = user?.id === card.user_id;

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
                  {formatDistanceToNow(new Date(card.created_at), { 
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
                onClick={() => toggleSaveCard(card.id, !!isSaved)}
                className="text-muted-foreground hover:text-foreground"
              >
                {isSaved ? (
                  <BookmarkCheck className="w-4 h-4 text-primary" />
                ) : (
                  <Bookmark className="w-4 h-4" />
                )}
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
            <div className="flex items-center space-x-2 md:space-x-4 flex-wrap gap-y-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className={`${likedCards.has(card.id) ? 'text-primary' : 'text-muted-foreground'} hover:text-primary`}
                onClick={() => toggleLikeCard(card.id)}
              >
                <ThumbsUp className={`w-4 h-4 mr-1 md:mr-2 ${likedCards.has(card.id) ? 'fill-current' : ''}`} />
                <span className="hidden md:inline">Beğen</span> {likeCounts[card.id] ? `(${likeCounts[card.id]})` : ''}
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-muted-foreground hover:text-primary"
                onClick={() => handleShare(card)}
              >
                <Share2 className="w-4 h-4 mr-1 md:mr-2" />
                <span className="hidden md:inline">Paylaş</span>
              </Button>
              
              {/* Network Share Toggle - Only for card owner */}
              {isOwner && showOwnerActions && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={`${card.is_public ? 'text-primary' : 'text-muted-foreground'} hover:text-primary`}
                  onClick={() => toggleCardVisibility(card.id, card.is_public)}
                  disabled={cardVisibilityLoading === card.id}
                >
                  {cardVisibilityLoading === card.id ? (
                    <Loader2 className="w-4 h-4 mr-1 md:mr-2 animate-spin" />
                  ) : card.is_public ? (
                    <Globe className="w-4 h-4 mr-1 md:mr-2" />
                  ) : (
                    <GlobeLock className="w-4 h-4 mr-1 md:mr-2" />
                  )}
                  <span className="hidden md:inline">{card.is_public ? 'Ağda' : 'Kişisel'}</span>
                </Button>
              )}
              
              {isOwner && showOwnerActions && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => deleteCard(card.id)}
                >
                  <Trash2 className="w-4 h-4 mr-1 md:mr-2" />
                  <span className="hidden md:inline">Sil</span>
                </Button>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Link 
                to={`/document/${card.documents?.slug}`}
                className="text-sm text-primary hover:text-primary-hover font-medium hidden md:inline"
              >
                {card.documents?.title}
              </Link>
              <Badge variant="secondary" className="text-xs">
                Okuma Kartı
              </Badge>
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
            <h1 className="text-3xl font-bold text-foreground mb-2">Okuma Kartları</h1>
            <p className="text-muted-foreground">
              Topluluktan ve kendi okuma kartlarınızdan öğrenin
            </p>
          </div>

          <Tabs defaultValue="personal" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="personal" className="flex items-center space-x-2">
                <span>Kişisel</span>
                <Badge variant="secondary" className="ml-2">
                  {personalCards.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="network" className="flex items-center space-x-2">
                <span>Ağ</span>
                <Badge variant="secondary" className="ml-2">
                  {networkCards.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="personal" className="space-y-6">
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(2)].map((_, i) => (
                    <Card key={i} className="animate-pulse">
                      <CardHeader>
                        <div className="h-6 bg-muted rounded w-3/4" />
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="h-4 bg-muted rounded w-full" />
                          <div className="h-4 bg-muted rounded w-5/6" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : personalCards.length === 0 ? (
                <div className="text-center py-12">
                  <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Henüz okuma kartı oluşturmamışsınız
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Belgelerinizden okuma kartları oluşturun ve bilginizi paylaşın.
                  </p>
                  <Button asChild className="bg-gradient-primary hover:opacity-90">
                    <Link to="/documents">Belgelerime Git</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {personalCards.map((card) => (
                    <ReadingCardComponent key={card.id} card={card} showOwnerActions={true} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="network" className="space-y-6">
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
              ) : networkCards.length === 0 ? (
                <div className="text-center py-12">
                  <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Henüz ağda okuma kartı yok
                  </h3>
                  <p className="text-muted-foreground">
                    Topluluk henüz hiç okuma kartı paylaşmamış.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {networkCards.map((card) => (
                    <ReadingCardComponent key={card.id} card={card} showOwnerActions={false} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Timeline;