/**
 * 자산배분이란? 가이드 페이지 냥~
 * 투자 초보자를 위한 자산배분 튜토리얼
 */
import { useState } from 'react'
import { BookOpen, Layers, RefreshCw, Cat, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { MarkdownContent } from '@/components/guide/MarkdownContent'

// 마크다운 콘텐츠 import
import guideBasics from '@/content/guide-basics.md'
import guideAssetClasses from '@/content/guide-asset-classes.md'
import guideRebalancing from '@/content/guide-rebalancing.md'
import guideMeowney from '@/content/guide-meowney.md'

interface GuideTab {
  id: string
  title: string
  icon: React.ComponentType<{ className?: string }>
  content: string
  description: string
}

const guideTabs: GuideTab[] = [
  {
    id: 'basics',
    title: '기초이론',
    icon: BookOpen,
    content: guideBasics,
    description: '자산배분이 무엇인지, 왜 중요한지 알아봅니다',
  },
  {
    id: 'asset-classes',
    title: '자산군',
    icon: Layers,
    content: guideAssetClasses,
    description: '주식, 채권, 현금 등 다양한 자산군을 소개합니다',
  },
  {
    id: 'rebalancing',
    title: '리밸런싱',
    icon: RefreshCw,
    content: guideRebalancing,
    description: '포트폴리오를 원래 비율로 되돌리는 방법을 배웁니다',
  },
  {
    id: 'meowney',
    title: '활용법',
    icon: Cat,
    content: guideMeowney,
    description: 'Meowney로 자산배분을 실천하는 방법을 익힙니다',
  },
]

export function GuidePage() {
  const [activeTab, setActiveTab] = useState('basics')

  const currentIndex = guideTabs.findIndex((tab) => tab.id === activeTab)
  const prevTab = currentIndex > 0 ? guideTabs[currentIndex - 1] : null
  const nextTab = currentIndex < guideTabs.length - 1 ? guideTabs[currentIndex + 1] : null

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">자산배분이란?</h1>
        <p className="text-muted-foreground mt-1">
          투자 입문자를 위한 자산배분 가이드 냥~
        </p>
      </div>

      {/* 탭 네비게이션 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          {guideTabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="flex items-center gap-2"
            >
              <tab.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.title}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* 탭 콘텐츠 */}
        {guideTabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="mt-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <tab.icon className="h-5 w-5 text-primary" />
                  {tab.title}
                </CardTitle>
                <CardDescription>{tab.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <MarkdownContent content={tab.content} />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* 하단 네비게이션 */}
      <div className="flex justify-between pt-4 border-t">
        {prevTab ? (
          <Button
            variant="ghost"
            onClick={() => setActiveTab(prevTab.id)}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">이전:</span>
            <span>{prevTab.title}</span>
          </Button>
        ) : (
          <div />
        )}

        {nextTab ? (
          <Button
            variant="ghost"
            onClick={() => setActiveTab(nextTab.id)}
            className="flex items-center gap-2"
          >
            <span className="hidden sm:inline">다음:</span>
            <span>{nextTab.title}</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <div />
        )}
      </div>
    </div>
  )
}
