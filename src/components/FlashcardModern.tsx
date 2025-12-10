import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, RotateCcw, Eye, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface FlashcardModernProps {
  id: string;
  question: string;
  answer: string;
  viewCount: number;
  documentTitle?: string;
  documentSlug?: string;
  onDelete?: (id: string) => void;
  onFlip?: (id: string) => void;
}

const FlashcardModern = ({
  id,
  question,
  answer,
  viewCount,
  documentTitle,
  documentSlug,
  onDelete,
  onFlip
}: FlashcardModernProps) => {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
    if (!isFlipped && onFlip) {
      onFlip(id);
    }
  };

  return (
    <div 
      className="group relative w-full h-64 cursor-pointer"
      onClick={handleFlip}
      style={{ perspective: '1000px' }}
    >
      <div
        className={cn(
          "relative w-full h-full transition-all duration-700 ease-in-out",
          isFlipped && "[transform:rotateY(180deg)]"
        )}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Front - Question */}
        <Card 
          className={cn(
            "absolute inset-0 overflow-hidden border-0",
            "bg-gradient-to-br from-primary/10 via-background to-primary/5",
            "shadow-lg hover:shadow-xl transition-shadow duration-300",
            "[backface-visibility:hidden]"
          )}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          
          <CardContent className="relative h-full p-6 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Soru
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs gap-1 bg-background/50 backdrop-blur-sm">
                  <Eye className="w-3 h-3" />
                  {viewCount}
                </Badge>
                {onDelete && (
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Question */}
            <div className="flex-1 flex items-center justify-center px-4">
              <h3 className="text-lg font-semibold text-foreground text-center leading-relaxed">
                {question}
              </h3>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
              {documentSlug && documentTitle && (
                <Link 
                  to={`/document/${documentSlug}`}
                  className="text-xs text-primary hover:text-primary/80 font-medium truncate max-w-[60%]"
                  onClick={(e) => e.stopPropagation()}
                >
                  {documentTitle}
                </Link>
              )}
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <RotateCcw className="w-3 h-3" />
                <span>Çevirmek için tıkla</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Back - Answer */}
        <Card 
          className={cn(
            "absolute inset-0 overflow-hidden border-0",
            "bg-gradient-to-br from-primary via-primary/90 to-primary/80",
            "shadow-lg hover:shadow-xl transition-shadow duration-300",
            "[backface-visibility:hidden] [transform:rotateY(180deg)]"
          )}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
          
          <CardContent className="relative h-full p-6 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-white/20">
                  <Sparkles className="w-4 h-4 text-primary-foreground" />
                </div>
                <span className="text-xs font-medium text-primary-foreground/80 uppercase tracking-wider">
                  Cevap
                </span>
              </div>
              
              {onDelete && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-primary-foreground/70 hover:text-primary-foreground hover:bg-white/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(id);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>

            {/* Answer */}
            <div className="flex-1 flex items-center justify-center px-4 overflow-y-auto">
              <p className="text-primary-foreground text-center leading-relaxed">
                {answer}
              </p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-center mt-4 pt-4 border-t border-white/20">
              <div className="flex items-center gap-1 text-xs text-primary-foreground/70">
                <RotateCcw className="w-3 h-3" />
                <span>Soruya dönmek için tıkla</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FlashcardModern;
