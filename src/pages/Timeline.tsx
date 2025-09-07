import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { BookOpen, User, Bookmark, BookmarkCheck, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useToast } from '@/components/ui/use-toast';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';

interface ReadingCard {
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
  saved_cards?: Array<{ id: string }>;
}

const Timeline = () => {
  const [networkCards, setNetworkCards] = useState<ReadingCard[]>([]);
  const [personalCards, setPersonalCards] = useState<ReadingCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchReadingCards();
  }, [user]);

  const fetchReadingCards = async () => {
    if (!user) return;

    try {
      // Fetch all reading cards (network) with saved status
      const { data: allCards, error: allError } = await supabase
        .from('reading_cards')
        .select(`
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
          ),
          saved_cards!left (
            id
          )
        `)
        .order('created_at', { ascending: false });

      if (allError) throw allError;

      // Fetch profiles for the cards
      const cardUserIds = [...new Set(allCards?.map(card => card.user_id) || [])];
      const { data: cardProfiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, username, avatar_url')
        .in('user_id', cardUserIds);

      // Combine cards with profiles
      const cardsWithProfiles = allCards?.map(card => ({
        ...card,
        profiles: cardProfiles?.find(p => p.user_id === card.user_id) || {
          full_name: 'Anonim Kullanıcı',
          username: 'anonymous',
          avatar_url: null
        }
      })) || [];

      // Fetch personal reading cards
      const { data: personalCards, error: personalError } = await supabase
        .from('reading_cards')
        .select(`
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
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (personalError) throw personalError;

      // Get user's profile
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('user_id, full_name, username, avatar_url')
        .eq('user_id', user.id)
        .single();

      const personalCardsWithProfile = personalCards?.map(card => ({
        ...card,
        profiles: userProfile || {
          full_name: 'Anonim Kullanıcı',
          username: 'anonymous',
          avatar_url: null
        }
      })) || [];

      if (personalError) throw personalError;

      setNetworkCards(cardsWithProfiles);
      setPersonalCards(personalCardsWithProfile);
    } catch (error) {
      console.error('Error fetching reading cards:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSaveCard = async (cardId: string, isSaved: boolean) => {
    if (!user) return;

    try {
      if (isSaved) {
        // Unsave the card
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
        // Save the card
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

      // Refresh the cards to update saved status
      fetchReadingCards();
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message || "Bir hata oluştu.",
        variant: "destructive",
      });
    }
  };

  const ReadingCardComponent = ({ card }: { card: ReadingCard }) => {
    const isSaved = card.saved_cards && card.saved_cards.length > 0;

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
                onClick={() => toggleSaveCard(card.id, isSaved)}
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
            
            <Badge variant="secondary" className="text-xs">
              Okuma Kartı
            </Badge>
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

          <Tabs defaultValue="network" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="network" className="flex items-center space-x-2">
                <span>Ağ</span>
                <Badge variant="secondary" className="ml-2">
                  {networkCards.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="personal" className="flex items-center space-x-2">
                <span>Kişisel</span>
                <Badge variant="secondary" className="ml-2">
                  {personalCards.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

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
                    Henüz okuma kartı yok
                  </h3>
                  <p className="text-muted-foreground">
                    Topluluk henüz hiç okuma kartı paylaşmamış.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {networkCards.map((card) => (
                    <ReadingCardComponent key={card.id} card={card} />
                  ))}
                </div>
              )}
            </TabsContent>

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
                    <ReadingCardComponent key={card.id} card={card} />
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