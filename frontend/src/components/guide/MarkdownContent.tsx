/**
 * 마크다운 콘텐츠 렌더러 냥~
 */
import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils'

interface MarkdownContentProps {
  content: string
  className?: string
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div
      className={cn(
        // Tailwind Typography prose 클래스
        'prose prose-gray dark:prose-invert max-w-none',
        // Meowney 커스텀 스타일
        'prose-headings:scroll-mt-20',
        'prose-h1:text-2xl prose-h1:font-bold prose-h1:mb-6',
        'prose-h2:text-xl prose-h2:font-bold prose-h2:mt-8 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-border',
        'prose-h3:text-lg prose-h3:font-semibold prose-h3:mt-6 prose-h3:mb-3',
        'prose-p:leading-7 prose-p:mb-4',
        'prose-li:my-1',
        'prose-ul:my-4 prose-ol:my-4',
        // ASCII 다이어그램 스타일
        'prose-pre:bg-muted prose-pre:text-foreground prose-pre:font-mono prose-pre:text-sm prose-pre:leading-relaxed prose-pre:whitespace-pre prose-pre:overflow-x-auto',
        'prose-code:bg-muted prose-code:text-foreground prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none',
        // 인용구 스타일 (팁 박스로 활용)
        'prose-blockquote:border-l-primary prose-blockquote:bg-primary/5 prose-blockquote:py-3 prose-blockquote:px-4 prose-blockquote:not-italic prose-blockquote:rounded-r-lg',
        // 테이블 스타일
        'prose-table:border prose-table:border-border',
        'prose-th:bg-muted prose-th:px-4 prose-th:py-2 prose-th:text-left prose-th:border prose-th:border-border',
        'prose-td:px-4 prose-td:py-2 prose-td:border prose-td:border-border',
        // 링크 스타일
        'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
        // 구분선 스타일
        'prose-hr:border-border prose-hr:my-8',
        className
      )}
    >
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}
