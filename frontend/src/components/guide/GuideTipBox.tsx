import { Cat, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GuideTipBoxProps {
  children: React.ReactNode;
  variant?: 'tip' | 'warning' | 'info';
}

const variantConfig = {
  tip: {
    icon: Cat,
    label: '집사 TIP',
    borderClass: 'border-l-primary',
    bgClass: 'bg-primary/5',
    iconClass: 'text-primary',
  },
  warning: {
    icon: AlertTriangle,
    label: '주의',
    borderClass: 'border-l-orange-500',
    bgClass: 'bg-orange-50 dark:bg-orange-950/20',
    iconClass: 'text-orange-500',
  },
  info: {
    icon: Info,
    label: '참고',
    borderClass: 'border-l-blue-500',
    bgClass: 'bg-blue-50 dark:bg-blue-950/20',
    iconClass: 'text-blue-500',
  },
};

export function GuideTipBox({ children, variant = 'tip' }: GuideTipBoxProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'border-l-4 rounded-r-lg p-4 flex gap-3',
        config.borderClass,
        config.bgClass
      )}
    >
      <Icon className={cn('w-5 h-5 flex-shrink-0 mt-0.5', config.iconClass)} />
      <div className="flex-1">
        <div className="font-bold mb-1">{config.label}</div>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  );
}
