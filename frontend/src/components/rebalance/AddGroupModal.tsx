/**
 * 배분 그룹 추가 모달 냥~ (weight 제거됨 - 단순화)
 */
import { useState } from 'react'
import { Plus, Trash2, Layers, Hash, FileText } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import type { Asset } from '@/types'

// weight 제거됨 - 단순 소속 관계만
interface GroupItemInput {
  id: string
  type: 'ticker' | 'alias'
  value: string
}

interface AddGroupModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (data: {
    name: string
    target_percentage: number
    items: Array<{ type: 'ticker' | 'alias'; value: string }>
  }) => void
  assets: Asset[]
}

export function AddGroupModal({
  open,
  onOpenChange,
  onAdd,
  assets,
}: AddGroupModalProps) {
  const [groupName, setGroupName] = useState('')
  const [targetPercentage, setTargetPercentage] = useState<number>(10)
  const [items, setItems] = useState<GroupItemInput[]>([])

  // 새 아이템 추가용 상태
  const [addItemType, setAddItemType] = useState<'ticker' | 'alias'>('ticker')
  const [newItemValue, setNewItemValue] = useState('')

  const generateId = () => Math.random().toString(36).substr(2, 9)

  const handleReset = () => {
    setGroupName('')
    setTargetPercentage(10)
    setItems([])
    setAddItemType('ticker')
    setNewItemValue('')
  }

  const handleAddItem = () => {
    if (!newItemValue.trim()) return

    const newItem: GroupItemInput = {
      id: generateId(),
      type: addItemType,
      value: addItemType === 'ticker' ? newItemValue.trim().toUpperCase() : newItemValue.trim(),
    }

    setItems((prev) => [...prev, newItem])
    setNewItemValue('')
  }

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  const handleSubmit = () => {
    if (!groupName.trim() || items.length === 0 || targetPercentage <= 0) return

    onAdd({
      name: groupName.trim(),
      target_percentage: targetPercentage,
      items: items.map((item) => ({
        type: item.type,
        value: item.value,
      })),
    })
    handleReset()
  }

  const isValid = groupName.trim().length > 0 && items.length > 0 && targetPercentage > 0

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      handleReset()
    }
    onOpenChange(newOpen)
  }

  // 보유 자산 매칭 확인
  const checkMatched = (type: 'ticker' | 'alias', value: string): Asset | undefined => {
    if (type === 'ticker') {
      return assets.find((a) => a.ticker === value)
    } else {
      const aliasLower = value.toLowerCase()
      return assets.find((a) => {
        const nameLower = a.name.toLowerCase()
        return aliasLower.includes(nameLower) || nameLower.includes(aliasLower)
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>그룹 추가</DialogTitle>
          <DialogDescription>
            여러 자산을 묶어서 하나의 목표 비율로 관리합니다.
            그룹 내 자산들의 합계가 그룹의 현재 가치가 됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 그룹 이름 및 목표 비율 */}
          <div className="flex gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="groupName">그룹 이름</Label>
              <Input
                id="groupName"
                placeholder="예: 단기채, 금현물, 배당주"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </div>
            <div className="w-28 space-y-2">
              <Label htmlFor="targetPct">목표 비율</Label>
              <div className="flex items-center gap-1">
                <Input
                  id="targetPct"
                  type="number"
                  min="0.1"
                  max="100"
                  step="0.1"
                  className="text-right"
                  value={targetPercentage}
                  onChange={(e) => setTargetPercentage(parseFloat(e.target.value) || 0)}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
          </div>

          {/* 추가된 아이템 목록 */}
          {items.length > 0 && (
            <div className="space-y-2">
              <Label>포함된 자산 ({items.length}개)</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {items.map((item) => {
                  const matched = checkMatched(item.type, item.value)

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 p-2 border rounded-lg bg-muted/30"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {item.type === 'ticker' ? (
                          <Hash className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <span className="font-medium truncate">{item.value}</span>
                        {matched && (
                          <Badge variant="secondary" className="text-xs">
                            {matched.name}
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 flex-shrink-0"
                        onClick={() => handleRemoveItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 새 아이템 추가 */}
          <div className="space-y-3 p-3 border rounded-lg bg-muted/20">
            <Label className="text-sm text-muted-foreground">자산 추가</Label>

            <RadioGroup
              value={addItemType}
              onValueChange={(v: string) => setAddItemType(v as 'ticker' | 'alias')}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="ticker" id="item-ticker" />
                <Label htmlFor="item-ticker" className="text-sm cursor-pointer">
                  티커
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="alias" id="item-alias" />
                <Label htmlFor="item-alias" className="text-sm cursor-pointer">
                  별칭
                </Label>
              </div>
            </RadioGroup>

            <div className="flex gap-2">
              <Input
                placeholder={addItemType === 'ticker' ? '예: SGOV, SHY' : '예: 금현물'}
                value={newItemValue}
                onChange={(e) =>
                  setNewItemValue(
                    addItemType === 'ticker' ? e.target.value.toUpperCase() : e.target.value
                  )
                }
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newItemValue.trim()) {
                    e.preventDefault()
                    handleAddItem()
                  }
                }}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleAddItem}
                disabled={!newItemValue.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              그룹에 포함된 자산들의 시가 합계가 그룹의 현재 가치로 계산됩니다.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid}>
            <Layers className="mr-2 h-4 w-4" />
            그룹 추가
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
