import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import { useTokenUsage } from '@/hooks/useTokenUsage';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, FileText, Bookmark, Plus, User, LogOut, Shield, Menu, X, Globe, Lock, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import CreateDocumentDialog from '@/components/CreateDocumentDialog';

interface HeaderProps {
  documentId?: string;
  isDocumentPublic?: boolean;
  isDocumentOwner?: boolean;
  onVisibilityUpdate?: (isPublic: boolean) => void;
}

const Header = ({ documentId, isDocumentPublic, isDocumentOwner, onVisibilityUpdate }: HeaderProps) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [visibilityLoading, setVisibilityLoading] = useState(false);
  const { tokenUsage, submitAdminCode } = useTokenUsage(user?.id);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const handleAdminCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminCode.trim()) {
      toast({
        variant: 'destructive',
        title: 'Hata',
        description: 'Lütfen admin kodunu girin',
      });
      return;
    }

    const result = await submitAdminCode(adminCode);
    if (result.success) {
      toast({
        title: 'Başarılı',
        description: 'Admin yetkisi başarıyla alındı!',
      });
      setAdminCode('');
    } else {
      toast({
        variant: 'destructive',
        title: 'Hata',
        description: result.error || 'Admin kodu geçersiz',
      });
    }
  };

  const toggleDocumentVisibility = async () => {
    if (!documentId || !onVisibilityUpdate) return;
    
    setVisibilityLoading(true);
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { error } = await supabase
        .from('documents')
        .update({ is_public: !isDocumentPublic })
        .eq('id', documentId);

      if (error) throw error;

      onVisibilityUpdate(!isDocumentPublic);
      toast({
        title: isDocumentPublic ? "Kişisel moda geçildi" : "Ağ moduna geçildi",
        description: isDocumentPublic 
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
      setVisibilityLoading(false);
    }
  };

  const usagePercentage = tokenUsage.isAdmin ? 0 : (tokenUsage.used / tokenUsage.limit) * 100;

  const navLinks = [
    { path: '/documents', icon: FileText, label: 'Belgeler' },
    { path: '/timeline', icon: BookOpen, label: 'Okuma Kartları' },
    { path: '/saved', icon: Bookmark, label: 'Çalışma Alanım' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 border-b border-border shadow-soft">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/timeline" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-xl text-foreground hidden sm:block">Self Medya</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-1">
          {navLinks.map(({ path, icon: Icon, label }) => (
            <Button
              key={path}
              variant={isActive(path) ? 'secondary' : 'ghost'}
              asChild
              className="text-sm font-medium"
            >
              <Link to={path} className="flex items-center space-x-2">
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </Link>
            </Button>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center space-x-2 md:space-x-3">
          {/* Document Visibility Toggle (if on document page) */}
          {isDocumentOwner && documentId && onVisibilityUpdate && (
            <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-muted/50 rounded-lg border border-border">
              {isDocumentPublic ? (
                <Globe className="w-4 h-4 text-primary" />
              ) : (
                <Lock className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="text-xs font-medium">
                {isDocumentPublic ? 'Ağ' : 'Kişisel'}
              </span>
              <Switch
                checked={isDocumentPublic}
                onCheckedChange={toggleDocumentVisibility}
                disabled={visibilityLoading}
                className="scale-75"
              />
              {visibilityLoading && <Loader2 className="w-3 h-3 animate-spin" />}
            </div>
          )}

          {/* Create Document Button */}
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-primary hover:opacity-90 shadow-soft">
                <Plus className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Belge Oluştur</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Yeni Belge</DialogTitle>
                <DialogDescription>
                  Manuel olarak belge oluşturun veya PDF dosyası yükleyin.
                </DialogDescription>
              </DialogHeader>
              <CreateDocumentDialog onClose={() => setCreateDialogOpen(false)} />
            </DialogContent>
          </Dialog>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9 border-2 border-primary/20">
                  <AvatarImage src={user?.user_metadata?.avatar_url} />
                  <AvatarFallback className="bg-primary/10 text-primary font-medium text-sm">
                    {user?.user_metadata?.full_name ? getInitials(user.user_metadata.full_name) : 'U'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80" align="end" forceMount>
              <div className="flex flex-col space-y-1 p-2">
                <p className="text-sm font-medium leading-none">{user?.user_metadata?.full_name || 'Kullanıcı'}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email}
                </p>
              </div>
              
              <DropdownMenuSeparator />
              
              {/* Token Usage */}
              <div className="px-2 py-3">
                {tokenUsage.isAdmin ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Shield className="w-4 h-4 text-primary" />
                    <span className="font-medium text-primary">Admin - Sınırsız Kullanım</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Günlük Token Kullanımı</span>
                      <span className="font-medium">
                        {tokenUsage.used.toLocaleString()} / {tokenUsage.limit.toLocaleString()}
                      </span>
                    </div>
                    <Progress value={usagePercentage} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      Kalan: {(tokenUsage.limit - tokenUsage.used).toLocaleString()} token
                    </p>
                  </div>
                )}
              </div>

              {/* Admin Code Input */}
              {!tokenUsage.isAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-3">
                    <form onSubmit={handleAdminCodeSubmit} className="space-y-2">
                      <label className="text-xs text-muted-foreground">Admin Kodu</label>
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          value={adminCode}
                          onChange={(e) => setAdminCode(e.target.value)}
                          placeholder="Admin kodunu girin"
                          className="h-8 text-sm"
                        />
                        <Button type="submit" size="sm" className="h-8">
                          Onayla
                        </Button>
                      </div>
                    </form>
                  </div>
                </>
              )}
              
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/profile" className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  <span>Profil</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Çıkış Yap</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile Menu Toggle */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px]">
              <SheetHeader>
                <SheetTitle className="flex items-center space-x-2">
                  <div className="w-6 h-6 bg-gradient-primary rounded-lg flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <span>Self Medya</span>
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col space-y-2 mt-6">
                {navLinks.map(({ path, icon: Icon, label }) => (
                  <Button
                    key={path}
                    variant={isActive(path) ? 'secondary' : 'ghost'}
                    asChild
                    className="justify-start"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Link to={path} className="flex items-center space-x-2">
                      <Icon className="w-4 h-4" />
                      <span>{label}</span>
                    </Link>
                  </Button>
                ))}
                
                {/* Mobile Document Visibility Toggle */}
                {isDocumentOwner && documentId && onVisibilityUpdate && (
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-lg border border-border mt-4">
                    <div className="flex items-center space-x-2">
                      {isDocumentPublic ? (
                        <Globe className="w-4 h-4 text-primary" />
                      ) : (
                        <Lock className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium">
                        {isDocumentPublic ? 'Ağ Modu' : 'Kişisel'}
                      </span>
                    </div>
                    <Switch
                      checked={isDocumentPublic}
                      onCheckedChange={toggleDocumentVisibility}
                      disabled={visibilityLoading}
                    />
                  </div>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

export default Header;