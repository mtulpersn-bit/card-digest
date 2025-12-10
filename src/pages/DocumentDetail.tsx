import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { ArrowLeft, BookOpen, Eye, User, Calendar, Bookmark, ThumbsUp, Share2, Trash2, Globe, GlobeLock, Loader2, Layers, Pencil } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import Header from '@/components/Header';
import { useToast } from '@/hooks/use-toast';
import CreateReadingCardDialog from '@/components/CreateReadingCardDialog';
import CreateFlashcardDialog from '@/components/CreateFlashcardDialog';
import EditReadingCardDialog from '@/components/EditReadingCardDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DocumentData {
  id: string;
  title: string;
  description: string;
  content: string;
  slug: string;
  read_count: number;
  created_at: string;
  user_id: string;
  file_url?: string;
  is_public: boolean;
  profiles: {
    display_name: string;
    avatar_url: string;
  };
  reading_cards: Array<{
    id: string;
    title: string;
    content: string;
    image_url?: string;
    card_order: number;
    is_public: boolean;
    user_id: string;
  }>;
}

const DocumentDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { isAdmin } = useAdminCheck(user?.id);
  const { toast } = useToast();
  const [document, setDocument] = useState<DocumentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savedCards, setSavedCards] = useState<Set<string>>(new Set());
  const [likedCards, setLikedCards] = useState<Set<string>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [cardVisibilityLoading, setCardVisibilityLoading] = useState<string | null>(null);
  const [documentVisibilityLoading, setDocumentVisibilityLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // Flashcard dialog state
  const [flashcardDialogOpen, setFlashcardDialogOpen] = useState(false);
  const [flashcardContent, setFlashcardContent] = useState('');
  
  // Edit reading card dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<{ id: string; title: string; content: string } | null>(null);

  useEffect(() => {
    if (slug) {
      fetchDocument();
      if (user) {
        fetchSavedCards();
        fetchLikedCards();
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
          file_url,
          is_public,
          reading_cards (
            id,
            title,
            content,
            image_url,
            card_order,
            is_public,
            user_id
          )
        `)
        .eq('slug', slug)
        .single();

      if (docError) {
        console.error('Error fetching document:', docError);
        navigate('/404');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .eq('id', docData.user_id)
        .single();

      const documentWithProfile = {
        ...docData,
        profiles: profile || {
          display_name: 'Anonim Kullanıcı',
          avatar_url: null
        },
        reading_cards: docData.reading_cards?.sort((a, b) => a.card_order - b.card_order) || []
      };

      setDocument(documentWithProfile);

      if (docData.reading_cards && docData.reading_cards.length > 0) {
        const cardIds = docData.reading_cards.map((card) => card.id);
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

  const handleShare = async (cardId: string, cardTitle: string, cardContent: string) => {
    const url = `${window.location.origin}/document/${document?.slug}#card-${cardId}`;
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

  const deleteReadingCard = async (cardId: string) => {
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

      fetchDocument();
    } catch (error) {
      console.error('Error deleting card:', error);
      toast({
        title: "Hata",
        description: "Kart silinirken bir hata oluştu.",
        variant: "destructive",
      });
    }
  };

  const toggleCardVisibility = async (cardId: string, currentIsPublic: boolean, cardUserId: string) => {
    if (!user) return;
    
    // Only owner or admin can toggle
    const canToggle = user.id === cardUserId || isAdmin;
    if (!canToggle) return;

    setCardVisibilityLoading(cardId);
    try {
      // Admin can update any card, owner can only update their own
      const query = supabase
        .from('reading_cards')
        .update({ is_public: !currentIsPublic })
        .eq('id', cardId);
      
      // Only filter by user_id if not admin
      if (!isAdmin) {
        query.eq('user_id', user.id);
      }

      const { error } = await query;

      if (error) throw error;

      toast({
        title: currentIsPublic ? "Kart kişisel yapıldı" : "Kart ağda paylaşıldı",
        description: currentIsPublic 
          ? "Bu kart artık sadece sahibine görünür." 
          : "Bu kart artık ağda herkese görünür.",
      });

      fetchDocument();
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

  const toggleDocumentVisibility = async () => {
    if (!document || !user) return;
    
    // Only owner or admin can toggle
    const canToggle = user.id === document.user_id || isAdmin;
    if (!canToggle) return;

    setDocumentVisibilityLoading(true);
    try {
      const { error } = await supabase
        .from('documents')
        .update({ is_public: !document.is_public })
        .eq('id', document.id);

      if (error) throw error;

      setDocument(prev => prev ? { ...prev, is_public: !prev.is_public } : null);
      
      // If document is made public, make all cards public by default
      if (!document.is_public) {
        document.reading_cards.forEach(async (card) => {
          if (!card.is_public) {
            await supabase
              .from('reading_cards')
              .update({ is_public: true })
              .eq('id', card.id);
          }
        });
        fetchDocument();
      }

      toast({
        title: document.is_public ? "Kişisel moda geçildi" : "Ağ moduna geçildi",
        description: document.is_public 
          ? "Belgeniz artık sadece size görünür." 
          : "Belgeniz artık herkese açık.",
      });
    } catch (error) {
      toast({
        title: "Hata",
        description: "Görünürlük değiştirilirken bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setDocumentVisibilityLoading(false);
    }
  };

  const deleteDocument = async () => {
    if (!document || !user) return;
    
    // Only owner can delete
    if (user.id !== document.user_id) {
      toast({
        title: "Yetki hatası",
        description: "Bu belgeyi silme yetkiniz yok.",
        variant: "destructive",
      });
      return;
    }

    setDeleteLoading(true);
    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', document.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Belge silindi",
        description: "Belge başarıyla silindi.",
      });

      navigate('/documents');
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: "Hata",
        description: "Belge silinirken bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setDeleteLoading(false);
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

  const isOwner = user?.id === document.user_id;
  const canToggleVisibility = isOwner || isAdmin;

  // Get display name - prefer full_name, fallback to display_name from profile
  const getDisplayName = () => {
    const profileName = document.profiles?.display_name;
    // If display_name looks like an email, try to show something else
    if (profileName && profileName.includes('@')) {
      return profileName.split('@')[0]; // Show part before @ as fallback
    }
    return profileName || 'Anonim Kullanıcı';
  };

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
                  {getDisplayName()}
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
              
              {/* Visibility Toggle - moved to account info row */}
              {canToggleVisibility && (
                <div className="flex items-center space-x-2 px-3 py-1.5 bg-muted/50 rounded-lg border border-border">
                  {document.is_public ? (
                    <Globe className="w-4 h-4 text-primary" />
                  ) : (
                    <GlobeLock className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className="text-xs font-medium">
                    {document.is_public ? 'Ağ' : 'Kişisel'}
                  </span>
                  <Switch
                    checked={document.is_public}
                    onCheckedChange={toggleDocumentVisibility}
                    disabled={documentVisibilityLoading}
                    className="scale-75"
                  />
                  {documentVisibilityLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                </div>
              )}
            </div>

            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-foreground mb-4">{document.title}</h1>
                
                {document.description && (
                  <p className="text-lg text-muted-foreground">{document.description}</p>
                )}
              </div>
              
              <div className="ml-6 flex flex-col items-end space-y-3">
                {isOwner && document.file_url && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => navigate(`/pdf/${document.slug}`)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Belgeyi Görüntüle
                  </Button>
                )}
                
                {/* Delete Document Button - only for owner */}
                {isOwner && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={deleteLoading}
                      >
                        {deleteLoading ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 mr-2" />
                        )}
                        Belgeyi Sil
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Bu belgeyi silmek istediğinize emin misiniz?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Bu işlem geri alınamaz. Belge ve tüm ilişkili okuma kartları kalıcı olarak silinecektir.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>İptal</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={deleteDocument}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Sil
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          </div>

          {/* Reading Cards */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-foreground flex items-center space-x-2">
                <BookOpen className="w-6 h-6" />
                <span>Okuma Kartları</span>
                <Badge variant="secondary">{document.reading_cards.length}</Badge>
              </h2>
              {isOwner && (
                <CreateReadingCardDialog
                  documentId={document.id}
                  documentContent={document.content}
                  fileUrl={document.file_url}
                  onCardCreated={fetchDocument}
                />
              )}
            </div>

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
                {document.reading_cards.map((card) => {
                  const cardIsOwner = user?.id === card.user_id;
                  const canToggleCardVisibility = cardIsOwner || isAdmin;
                  
                  return (
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
                            <div className="lg:w-2/3" id={`card-${card.id}`}>
                              <CardTitle className="text-2xl font-bold text-foreground mb-4">
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
                          <div className="mb-6" id={`card-${card.id}`}>
                            <CardTitle className="text-2xl font-bold text-foreground mb-4">
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
                              onClick={() => handleShare(card.id, card.title, card.content)}
                            >
                              <Share2 className="w-4 h-4 mr-1 md:mr-2" />
                              <span className="hidden md:inline">Paylaş</span>
                            </Button>
                            
                            {/* Network Share Toggle - for card owner or admin */}
                            {canToggleCardVisibility && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className={`${card.is_public ? 'text-primary' : 'text-muted-foreground'} hover:text-primary`}
                                onClick={() => toggleCardVisibility(card.id, card.is_public, card.user_id)}
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
                            
                            {cardIsOwner && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-muted-foreground hover:text-primary"
                                onClick={() => {
                                  setEditingCard({ id: card.id, title: card.title, content: card.content });
                                  setEditDialogOpen(true);
                                }}
                              >
                                <Pencil className="w-4 h-4 mr-1 md:mr-2" />
                                <span className="hidden md:inline">Düzenle</span>
                              </Button>
                            )}
                            
                            {cardIsOwner && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-muted-foreground hover:text-destructive"
                                onClick={() => deleteReadingCard(card.id)}
                              >
                                <Trash2 className="w-4 h-4 mr-1 md:mr-2" />
                                <span className="hidden md:inline">Sil</span>
                              </Button>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setFlashcardContent(card.content);
                                setFlashcardDialogOpen(true);
                              }}
                              className="text-muted-foreground hover:text-primary"
                            >
                              <Layers className="w-4 h-4 mr-1 md:mr-2" />
                              <span className="hidden md:inline">Flashcard</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleSaveCard(card.id)}
                              className={`hover:bg-primary/10 ${savedCards.has(card.id) ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
                            >
                              <Bookmark className={`w-4 h-4 mr-1 md:mr-2 ${savedCards.has(card.id) ? 'fill-current' : ''}`} />
                              <span className="hidden md:inline">{savedCards.has(card.id) ? 'Kaydedildi' : 'Kaydet'}</span>
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
      
      {/* Flashcard Dialog */}
      {document && (
        <CreateFlashcardDialog
          documentId={document.id}
          selectedText={flashcardContent}
          isOpen={flashcardDialogOpen}
          onClose={() => {
            setFlashcardDialogOpen(false);
            setFlashcardContent('');
          }}
        />
      )}
      
      {/* Edit Reading Card Dialog */}
      {editingCard && (
        <EditReadingCardDialog
          cardId={editingCard.id}
          initialTitle={editingCard.title}
          initialContent={editingCard.content}
          isOpen={editDialogOpen}
          onClose={() => {
            setEditDialogOpen(false);
            setEditingCard(null);
          }}
          onSave={() => fetchDocument()}
        />
      )}
    </div>
  );
};

export default DocumentDetail;
