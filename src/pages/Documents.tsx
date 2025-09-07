import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { FileText, User, Eye, BookOpen, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import Header from '@/components/Header';

interface Document {
  id: string;
  title: string;
  description: string;
  slug: string;
  read_count: number;
  created_at: string;
  profiles: {
    full_name: string;
    username: string;
    avatar_url: string;
  };
  reading_cards: Array<{ id: string }>;
}

const Documents = () => {
  const [networkDocuments, setNetworkDocuments] = useState<Document[]>([]);
  const [personalDocuments, setPersonalDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchDocuments();
  }, [user]);

  const fetchDocuments = async () => {
    if (!user) return;

    try {
      // Fetch all documents (network)
      const { data: allDocs, error: allError } = await supabase
        .from('documents')
        .select(`
          id,
          title,
          description,
          slug,
          read_count,
          created_at,
          user_id,
          reading_cards (id)
        `)
        .order('created_at', { ascending: false });

      if (allError) throw allError;

      // Fetch profiles for the documents
      const userIds = [...new Set(allDocs?.map(doc => doc.user_id) || [])];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, username, avatar_url')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      // Combine documents with profiles
      const docsWithProfiles = allDocs?.map(doc => ({
        ...doc,
        profiles: profiles?.find(p => p.user_id === doc.user_id) || {
          full_name: 'Anonim Kullanıcı',
          username: 'anonymous',
          avatar_url: null
        }
      })) || [];

      // Fetch personal documents
      const { data: personalDocs, error: personalError } = await supabase
        .from('documents')
        .select(`
          id,
          title,
          description,
          slug,
          read_count,
          created_at,
          user_id,
          reading_cards (id)
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

      const personalDocsWithProfile = personalDocs?.map(doc => ({
        ...doc,
        profiles: userProfile || {
          full_name: 'Anonim Kullanıcı',
          username: 'anonymous',
          avatar_url: null
        }
      })) || [];

      if (personalError) throw personalError;

      setNetworkDocuments(docsWithProfiles);
      setPersonalDocuments(personalDocsWithProfile);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const DocumentCard = ({ document }: { document: Document }) => (
    <Card className="group hover:shadow-medium transition-all duration-300 hover:-translate-y-1 bg-gradient-card border-0">
      <CardHeader className="pb-3">
        <div className="flex items-center space-x-3 mb-3">
          <Avatar className="h-10 w-10 border-2 border-primary/20">
            <AvatarImage src={document.profiles?.avatar_url} />
            <AvatarFallback className="bg-primary/10 text-primary">
              <User className="w-5 h-5" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              {document.profiles?.full_name || 'Anonim Kullanıcı'}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(document.created_at), { 
                addSuffix: true, 
                locale: tr 
              })}
            </p>
          </div>
        </div>
        
        {document.description && (
          <CardDescription className="text-sm text-muted-foreground mb-3">
            {document.description}
          </CardDescription>
        )}
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="flex items-start space-x-4">
          <div className="flex-1">
            <Link to={`/document/${document.slug}`}>
              <CardTitle className="text-lg font-semibold hover:text-primary transition-colors cursor-pointer group-hover:text-primary">
                {document.title}
              </CardTitle>
            </Link>
            
            <div className="flex items-center space-x-4 mt-3">
              <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                <BookOpen className="w-4 h-4" />
                <span>{document.reading_cards?.length || 0} okuma kartı</span>
              </div>
              <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                <Eye className="w-4 h-4" />
                <span>{document.read_count} okunma</span>
              </div>
            </div>
          </div>
          
          <div className="w-16 h-16 bg-gradient-secondary rounded-lg flex items-center justify-center shadow-soft">
            <FileText className="w-8 h-8 text-primary" />
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
            <h1 className="text-3xl font-bold text-foreground mb-2">Belgeler</h1>
            <p className="text-muted-foreground">
              Topluluktan ve kendi belgelerinizden okuma kartları keşfedin
            </p>
          </div>

          <Tabs defaultValue="network" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="network" className="flex items-center space-x-2">
                <span>Ağ</span>
                <Badge variant="secondary" className="ml-2">
                  {networkDocuments.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="personal" className="flex items-center space-x-2">
                <span>Kişisel</span>
                <Badge variant="secondary" className="ml-2">
                  {personalDocuments.length}
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
                          <div className="h-4 bg-muted rounded w-1/2" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : networkDocuments.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Henüz belge yok
                  </h3>
                  <p className="text-muted-foreground">
                    Topluluk henüz hiç belge paylaşmamış.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {networkDocuments.map((document) => (
                    <DocumentCard key={document.id} document={document} />
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
                        <div className="h-4 bg-muted rounded w-1/2" />
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              ) : personalDocuments.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Henüz belge oluşturmamışsınız
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    İlk belgenizi oluşturun ve okuma kartlarınızı paylaşmaya başlayın.
                  </p>
                  <Button className="bg-gradient-primary hover:opacity-90">
                    Belge Oluştur
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {personalDocuments.map((document) => (
                    <DocumentCard key={document.id} document={document} />
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

export default Documents;