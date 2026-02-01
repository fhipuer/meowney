import { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface GuideSectionProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export function GuideSection({
  icon: Icon,
  title,
  description,
  children,
  delay = 0,
  className,
}: GuideSectionProps) {
  return (
    <Card
      className={cn(
        'border-0 shadow-sm bg-gradient-to-br from-background to-muted/30',
        'animate-slide-up',
        className
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="p-6">
        {/* Header with icon and title */}
        <div className="flex items-start gap-3 mb-4">
          <div className="bg-primary/10 rounded-full p-2 flex-shrink-0">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold mb-1">{title}</h3>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>

        {/* Content area */}
        <div className="space-y-4">{children}</div>
      </div>
    </Card>
  );
}
