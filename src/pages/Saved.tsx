import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { BookOpen, User, BookmarkX, ExternalLink, Bookmark, ThumbsUp, Share2, Trash2, Layers, Globe, Lock } from 'lucide-react';
import FlashcardModern from '@/components/FlashcardModern';
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

interface Flashcard {
  id: string;
  question: string;
  answer: string;
  created_at: string;
  document_id: string;
  view_count: number;
  documents: {
    title: string;
    slug: string;
  };
}

interface ReadingCard {
  id: string;
  title: string;
  content: string;
  image_url?: string;
  created_at: string;
  document_id: string;
  user_id: string;
  documents: {
    title: string;
    slug: string;
    is_public: boolean;
  };
}

interface Document {
  id: string;
  title: string;
  description: string;
  slug: string;
  read_count: number;
  created_at: string;
  is_public: boolean;
  reading_cards: Array<{ id: string }>;
}

const Saved = () => {
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [readingCards, setReadingCards] = useState<ReadingCard[]>([]);
  const [networkReadingCards, setNetworkReadingCards] = useState<ReadingCard[]>([]);
  const [personalDocuments, setPersonalDocuments] = useState<Document[]>([]);
  const [networkDocuments, setNetworkDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFlashcardsLoading, setIsFlashcardsLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  const [likedCards, setLikedCards] = useState<Set<string>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [flippedCards, setFlippedCards] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      fetchAllData();
    }
  }, [user]);

  const fetchAllData = async () => {
    if (!user) return;
    await Promise.all([
      fetchSavedCards(),
      fetchFlashcards(),
      fetchReadingCards(),
      fetchDocuments(),
      fetchLikedCards(),
    ]);
  };

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

      const cardUserIds = [...new Set(data?.map(item => item.reading_cards.user_id) || [])];
      const { data: cardProfiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', cardUserIds);

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
        setLikeCounts(prev => ({ ...prev, ...counts }));
      }
    } catch (error) {
      console.error('Error fetching saved cards:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFlashcards = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('flashcards')
        .select(`
          id,
          question,
          answer,
          created_at,
          document_id,
          view_count,
          documents (
            title,
            slug
          )
        `)
        .eq('user_id', user.id)
        .order('view_count', { ascending: true });

      if (error) throw error;
      setFlashcards(data || []);
    } catch (error) {
      console.error('Error fetching flashcards:', error);
    } finally {
      setIsFlashcardsLoading(false);
    }
  };

  const fetchReadingCards = async () => {
    if (!user) return;

    try {
      // Personal reading cards
      const { data: personalData, error: personalError } = await supabase
        .from('reading_cards')
        .select(`
          id,
          title,
          content,
          image_url,
          created_at,
          document_id,
          user_id,
          documents (
            title,
            slug,
            is_public
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (personalError) throw personalError;
      setReadingCards(personalData || []);

      // Network reading cards (from public documents)
      const { data: networkData, error: networkError } = await supabase
        .from('reading_cards')
        .select(`
          id,
          title,
          content,
          image_url,
          created_at,
          document_id,
          user_id,
          documents!inner (
            title,
            slug,
            is_public
          )
        `)
        .eq('documents.is_public', true)
        .order('created_at', { ascending: false });

      if (networkError) throw networkError;
      setNetworkReadingCards(networkData || []);

      // Fetch like counts for all cards
      const allCardIds = [...(personalData || []), ...(networkData || [])].map(c => c.id);
      if (allCardIds.length > 0) {
        const { data: likesData } = await supabase
          .from('reading_card_likes')
          .select('reading_card_id')
          .in('reading_card_id', allCardIds);

        const counts: Record<string, number> = {};
        likesData?.forEach((like) => {
          counts[like.reading_card_id] = (counts[like.reading_card_id] || 0) + 1;
        });
        setLikeCounts(prev => ({ ...prev, ...counts }));
      }
    } catch (error) {
      console.error('Error fetching reading cards:', error);
    }
  };

  const fetchDocuments = async () => {
    if (!user) return;

    try {
      // Personal documents
      const { data: personalData, error: personalError } = await supabase
        .from('documents')
        .select(`
          id,
          title,
          description,
          slug,
          read_count,
          created_at,
          is_public,
          reading_cards (id)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (personalError) throw personalError;
      setPersonalDocuments(personalData || []);

      // Network documents (public only)
      const { data: networkData, error: networkError } = await supabase
        .from('documents')
        .select(`
          id,
          title,
          description,
          slug,
          read_count,
          created_at,
          is_public,
          reading_cards (id)
        `)
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (networkError) throw networkError;
      setNetworkDocuments(networkData || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
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

  const handleShare = async (cardId: string, cardTitle: string, cardContent: string, slug?: string) => {
    const url = `${window.location.origin}/document/${slug}#card-${cardId}`;
    const shareText = `${cardTitle}\n\n${cardContent}\n\n${url}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: cardTitle,
          text: cardContent,
          url: url,
        });
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          copyToClipboard(shareText);
        }
      }
    } else {
      copyToClipboard(shareText);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "İçerik kopyalandı",
      description: "Kart içeriği panoya kopyalandı.",
    });
  };

  const unsaveCard = async (savedCardId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('saved_cards')
        .delete()
        .eq('id', savedCardId);

      if (error) throw error;

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

  const deleteFlashcard = async (flashcardId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('flashcards')
        .delete()
        .eq('id', flashcardId)
        .eq('user_id', user.id);

      if (error) throw error;

      setFlashcards(prev => prev.filter(card => card.id !== flashcardId));

      toast({
        title: "Flashcard silindi",
        description: "Flashcard başarıyla silindi.",
      });
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message || "Bir hata oluştu.",
        variant: "destructive",
      });
    }
  };

  const deleteReadingCard = async (cardId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('reading_cards')
        .delete()
        .eq('id', cardId)
        .eq('user_id', user.id);

      if (error) throw error;

      setReadingCards(prev => prev.filter(card => card.id !== cardId));
      setNetworkReadingCards(prev => prev.filter(card => card.id !== cardId));

      toast({
        title: "Kart silindi",
        description: "Okuma kartı başarıyla silindi.",
      });
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message || "Bir hata oluştu.",
        variant: "destructive",
      });
    }
  };

  const flipCard = async (flashcardId: string) => {
    const isFlipped = flippedCards.has(flashcardId);
    
    if (!isFlipped) {
      // Increment view count when flipping to answer
      try {
        const flashcard = flashcards.find(f => f.id === flashcardId);
        if (flashcard) {
          await supabase
            .from('flashcards')
            .update({ view_count: flashcard.view_count + 1 })
            .eq('id', flashcardId);

          setFlashcards(prev => prev.map(f => 
            f.id === flashcardId ? { ...f, view_count: f.view_count + 1 } : f
          ));
        }
      } catch (error) {
        console.error('Error updating view count:', error);
      }
    }

    setFlippedCards(prev => {
      const newSet = new Set(prev);
      if (isFlipped) {
        newSet.delete(flashcardId);
      } else {
        newSet.add(flashcardId);
      }
      return newSet;
    });
  };

  const SavedCardComponent = ({ savedCard }: { savedCard: SavedCard }) => {
    const card = savedCard.reading_cards;
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
                onClick={() => unsaveCard(savedCard.id)}
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
            <CardDescription className="text-foreground leading-relaxed">
              {card.content}
            </CardDescription>
          </div>
          
          <div className="flex items-center justify-between pt-4 border-t border-border/50">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="sm" 
                className={`${likedCards.has(card.id) ? 'text-primary' : 'text-muted-foreground'} hover:text-primary`}
                onClick={() => toggleLikeCard(card.id)}
              >
                <ThumbsUp className={`w-4 h-4 mr-2 ${likedCards.has(card.id) ? 'fill-current' : ''}`} />
                {likeCounts[card.id] || 0}
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-muted-foreground hover:text-primary"
                onClick={() => handleShare(card.id, card.title, card.content, card.documents?.slug)}
              >
                <Share2 className="w-4 h-4" />
              </Button>
              {isOwner && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-muted-foreground hover:text-destructive"
                  onClick={async () => {
                    try {
                      const { error } = await supabase
                        .from('reading_cards')
                        .delete()
                        .eq('id', card.id)
                        .eq('user_id', user.id);

                      if (error) throw error;
                      setSavedCards(prev => prev.filter(sc => sc.reading_cards.id !== card.id));
                      toast({ title: "Kart silindi" });
                    } catch (error) {
                      toast({ title: "Hata", variant: "destructive" });
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
            <Link 
              to={`/document/${card.documents?.slug}`}
              className="text-sm text-primary hover:text-primary-hover font-medium"
            >
              {card.documents?.title}
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  };

  const FlashcardComponent = ({ flashcard }: { flashcard: Flashcard }) => {
    const isFlipped = flippedCards.has(flashcard.id);

    return (
      <div className="perspective-1000">
        <div 
          className={`relative w-full h-48 cursor-pointer transition-transform duration-500 transform-style-preserve-3d ${isFlipped ? 'rotate-y-180' : ''}`}
          onClick={() => flipCard(flashcard.id)}
          style={{
            transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Front - Question */}
          <Card 
            className="absolute inset-0 bg-gradient-card border-0 backface-hidden"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <CardContent className="p-6 h-full flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <Link 
                  to={`/document/${flashcard.documents?.slug}`}
                  className="text-sm text-primary hover:text-primary-hover font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  {flashcard.documents?.title}
                </Link>
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary" className="text-xs">
                    {flashcard.view_count} görüntüleme
                  </Badge>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteFlashcard(flashcard.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <div className="flex-1 flex items-center justify-center">
                <h3 className="text-lg font-semibold text-foreground text-center">
                  {flashcard.question}
                </h3>
              </div>
              
              <p className="text-xs text-muted-foreground text-center mt-2">
                Cevabı görmek için tıklayın
              </p>
            </CardContent>
          </Card>

          {/* Back - Answer */}
          <Card 
            className="absolute inset-0 bg-primary/5 border-2 border-primary/20"
            style={{ 
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)'
            }}
          >
            <CardContent className="p-6 h-full flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <Badge variant="outline" className="text-xs">Cevap</Badge>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteFlashcard(flashcard.id);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="flex-1 flex items-center justify-center">
                <p className="text-foreground text-center leading-relaxed">
                  {flashcard.answer}
                </p>
              </div>
              
              <p className="text-xs text-muted-foreground text-center mt-2">
                Soruya dönmek için tıklayın
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  const ReadingCardComponent = ({ card, isNetwork = false }: { card: ReadingCard; isNetwork?: boolean }) => {
    const isOwner = user?.id === card.user_id;

    return (
      <Card className="group hover:shadow-medium transition-all duration-300 bg-gradient-card border-0">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-3">
            <Link 
              to={`/document/${card.documents?.slug}`}
              className="text-sm text-primary hover:text-primary-hover font-medium"
            >
              {card.documents?.title}
            </Link>
            <div className="flex items-center space-x-2">
              {card.documents?.is_public ? (
                <Globe className="w-4 h-4 text-primary" />
              ) : (
                <Lock className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </div>
          
          <CardTitle className="text-lg font-semibold text-foreground mb-2">
            {card.title}
          </CardTitle>
          <CardDescription className="text-foreground leading-relaxed mb-4">
            {card.content.length > 200 ? card.content.substring(0, 200) + '...' : card.content}
          </CardDescription>
          
          <div className="flex items-center justify-between pt-4 border-t border-border/50">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="sm" 
                className={`${likedCards.has(card.id) ? 'text-primary' : 'text-muted-foreground'} hover:text-primary`}
                onClick={() => toggleLikeCard(card.id)}
              >
                <ThumbsUp className={`w-4 h-4 mr-2 ${likedCards.has(card.id) ? 'fill-current' : ''}`} />
                {likeCounts[card.id] || 0}
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-muted-foreground hover:text-primary"
                onClick={() => handleShare(card.id, card.title, card.content, card.documents?.slug)}
              >
                <Share2 className="w-4 h-4" />
              </Button>
              {isOwner && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => deleteReadingCard(card.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(card.created_at), { addSuffix: true, locale: tr })}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  };

  const DocumentCardComponent = ({ document }: { document: Document }) => (
    <Card className="group hover:shadow-medium transition-all duration-300 bg-gradient-card border-0">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            {document.is_public ? (
              <Globe className="w-4 h-4 text-primary" />
            ) : (
              <Lock className="w-4 h-4 text-muted-foreground" />
            )}
            <Badge variant="secondary" className="text-xs">
              {document.reading_cards?.length || 0} kart
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(document.created_at), { addSuffix: true, locale: tr })}
          </p>
        </div>
        
        <Link to={`/document/${document.slug}`}>
          <CardTitle className="text-lg font-semibold text-foreground hover:text-primary transition-colors mb-2">
            {document.title}
          </CardTitle>
        </Link>
        
        {document.description && (
          <CardDescription className="text-muted-foreground mb-4">
            {document.description}
          </CardDescription>
        )}
        
        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
          <div className="flex items-center space-x-1">
            <BookOpen className="w-4 h-4" />
            <span>{document.reading_cards?.length || 0} okuma kartı</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

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
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Çalışma Alanım</h1>
            <p className="text-muted-foreground">
              Flashcard'larınız, okuma kartlarınız ve belgeleriniz
            </p>
          </div>

          <Tabs defaultValue="flashcards" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="flashcards" className="flex items-center gap-2">
                <Layers className="w-4 h-4" />
                <span>Flashcard</span>
              </TabsTrigger>
              <TabsTrigger value="saved" className="flex items-center gap-2">
                <Bookmark className="w-4 h-4" />
                <span>Kaydedilenler</span>
              </TabsTrigger>
            </TabsList>

            {/* Flashcards Tab */}
            <TabsContent value="flashcards">
              {isFlashcardsLoading ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {[...Array(4)].map((_, i) => (
                    <Card key={i} className="animate-pulse h-48" />
                  ))}
                </div>
              ) : flashcards.length === 0 ? (
                <div className="text-center py-12">
                  <Layers className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Henüz flashcard yok
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    PDF belgelerinizden flashcard'lar oluşturun.
                  </p>
                  <Button asChild className="bg-gradient-primary hover:opacity-90">
                    <Link to="/documents">Belgelerime Git</Link>
                  </Button>
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2">
                  {flashcards.map((flashcard) => (
                    <FlashcardModern
                      key={flashcard.id}
                      id={flashcard.id}
                      question={flashcard.question}
                      answer={flashcard.answer}
                      viewCount={flashcard.view_count}
                      documentTitle={flashcard.documents?.title}
                      documentSlug={flashcard.documents?.slug}
                      onDelete={deleteFlashcard}
                      onFlip={flipCard}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Saved Cards Tab */}
            <TabsContent value="saved">
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Card key={i} className="animate-pulse h-32" />
                  ))}
                </div>
              ) : savedCards.length === 0 ? (
                <div className="text-center py-12">
                  <Bookmark className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Henüz kayıtlı kart yok
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Beğendiğiniz okuma kartlarını kaydedin.
                  </p>
                  <Button asChild className="bg-gradient-primary hover:opacity-90">
                    <Link to="/timeline">Keşfet</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {savedCards.map((savedCard) => (
                    <SavedCardComponent key={savedCard.id} savedCard={savedCard} />
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

export default Saved;