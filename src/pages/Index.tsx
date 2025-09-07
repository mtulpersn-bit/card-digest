import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { BookOpen, FileText, Bookmark, Users, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12 py-16 bg-gradient-secondary rounded-3xl shadow-large">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-primary rounded-3xl mb-6 shadow-glow">
              <BookOpen className="w-10 h-10 text-primary-foreground" />
            </div>
            <h1 className="text-4xl font-bold text-foreground mb-4">
              Hoş geldin, <span className="text-primary">{user.user_metadata?.full_name?.split(' ')[0] || 'Kullanıcı'}</span>!
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Self Medya ile faydalı içeriklerle dolu bir sosyal medya deneyimi yaşa. 
              Belgelerden okuma kartları oluştur ve topluluğun bilgisinden faydalın.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="bg-gradient-primary hover:opacity-90 shadow-soft">
                <Link to="/documents">
                  <FileText className="w-5 h-5 mr-2" />
                  Belgeler
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/timeline">
                  <Sparkles className="w-5 h-5 mr-2" />
                  Okuma Kartları
                </Link>
              </Button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="group hover:shadow-medium transition-all duration-300 hover:-translate-y-1 bg-gradient-card border-0">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>Belgeler</CardTitle>
                <CardDescription>
                  Topluluktan ve kendi belgelerinizden okuma kartları keşfedin
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="ghost" className="w-full justify-start">
                  <Link to="/documents">
                    Belgeleri Görüntüle
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-medium transition-all duration-300 hover:-translate-y-1 bg-gradient-card border-0">
              <CardHeader>
                <div className="w-12 h-12 bg-accent/20 rounded-xl flex items-center justify-center mb-4">
                  <BookOpen className="w-6 h-6 text-accent-foreground" />
                </div>
                <CardTitle>Okuma Kartları</CardTitle>
                <CardDescription>
                  Algoritma ile sıralanmış okuma kartları timeline'ında keşif yapın
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="ghost" className="w-full justify-start">
                  <Link to="/timeline">
                    Timeline'ı Görüntüle
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-medium transition-all duration-300 hover:-translate-y-1 bg-gradient-card border-0">
              <CardHeader>
                <div className="w-12 h-12 bg-secondary/50 rounded-xl flex items-center justify-center mb-4">
                  <Bookmark className="w-6 h-6 text-secondary-foreground" />
                </div>
                <CardTitle>Kaydedilenler</CardTitle>
                <CardDescription>
                  Beğendiğiniz okuma kartlarını kaydedin ve daha sonra erişin
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="ghost" className="w-full justify-start">
                  <Link to="/saved">
                    Kayıtları Görüntüle
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Features */}
          <div className="mt-16 text-center">
            <h2 className="text-2xl font-bold text-foreground mb-8">
              Neden Self Medya?
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="text-left">
                <Users className="w-8 h-8 text-primary mb-4" />
                <h3 className="text-lg font-semibold mb-2">Topluluk Odaklı</h3>
                <p className="text-muted-foreground">
                  Diğer kullanıcıların belgelerinden ve okuma kartlarından öğrenin, 
                  kendi bilginizi de paylaşın.
                </p>
              </div>
              <div className="text-left">
                <Sparkles className="w-8 h-8 text-primary mb-4" />
                <h3 className="text-lg font-semibold mb-2">Akıllı İçerik</h3>
                <p className="text-muted-foreground">
                  Sosyal medyanın bağımlılık yapan yapısını eğitici içerikler için kullanın.
                  Faydalı bilgilerle vakit geçirin.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
