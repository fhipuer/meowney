import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GuideStatCardProps {
  value: string;
  label: string;
  icon: LucideIcon;
  colorClass?: string;
  bgClass?: string;
  delay?: number;
}

export function GuideStatCard({
  value,
  label,
  icon: Icon,
  colorClass = 'text-primary',
  bgClass = 'bg-primary/5',
  delay = 0,
}: GuideStatCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl p-4 sm:p-6 relative',
        'hover:shadow-md transition-shadow',
        'animate-slide-up',
        bgClass
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Icon in top-right */}
      <div className="absolute top-4 right-4 bg-background/50 rounded-full p-2">
        <Icon className={cn('w-5 h-5', colorClass)} />
      </div>

      {/* Value and label */}
      <div className="pr-12">
        <div className={cn('text-3xl font-bold mb-2', colorClass)}>{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
