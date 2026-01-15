/**
 * 배분 그룹 추가 모달 냥~
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

interface GroupItemInput {
  id: string
  type: 'ticker' | 'alias'
  value: string
  weight: number
}

interface AddGroupModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (data: {
    name: string
    items: Array<{ type: 'ticker' | 'alias'; value: string; weight: number }>
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
  const [items, setItems] = useState<GroupItemInput[]>([])

  // 새 아이템 추가용 상태
  const [addItemType, setAddItemType] = useState<'ticker' | 'alias'>('ticker')
  const [newItemValue, setNewItemValue] = useState('')
  const [newItemWeight, setNewItemWeight] = useState(100)

  const generateId = () => Math.random().toString(36).substr(2, 9)

  const handleReset = () => {
    setGroupName('')
    setItems([])
    setAddItemType('ticker')
    setNewItemValue('')
    setNewItemWeight(100)
  }

  const handleAddItem = () => {
    if (!newItemValue.trim()) return

    const newItem: GroupItemInput = {
      id: generateId(),
      type: addItemType,
      value: addItemType === 'ticker' ? newItemValue.trim().toUpperCase() : newItemValue.trim(),
      weight: newItemWeight,
    }

    setItems((prev) => [...prev, newItem])
    setNewItemValue('')
    setNewItemWeight(100)
  }

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  const handleItemWeightChange = (id: string, weight: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, weight: Math.min(100, Math.max(1, weight)) } : item
      )
    )
  }

  const handleSubmit = () => {
    if (!groupName.trim() || items.length === 0) return

    onAdd({
      name: groupName.trim(),
      items: items.map((item) => ({
        type: item.type,
        value: item.value,
        weight: item.weight,
      })),
    })
    handleReset()
  }

  const isValid = groupName.trim().length > 0 && items.length > 0

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

  // 총 가중치 계산
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>그룹 추가</DialogTitle>
          <DialogDescription>
            여러 자산을 묶어서 하나의 목표 비율로 관리합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 그룹 이름 */}
          <div className="space-y-2">
            <Label htmlFor="groupName">그룹 이름</Label>
            <Input
              id="groupName"
              placeholder="예: 단기채, 금현물, 배당주"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          </div>

          {/* 추가된 아이템 목록 */}
          {items.length > 0 && (
            <div className="space-y-2">
              <Label>포함된 자산 ({items.length}개)</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {items.map((item) => {
                  const matched = checkMatched(item.type, item.value)
                  const weightPct = totalWeight > 0 ? (item.weight / totalWeight) * 100 : 0

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
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-muted-foreground">
                          ({weightPct.toFixed(0)}%)
                        </span>
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          step="1"
                          className="w-14 h-7 text-right text-xs"
                          value={item.weight}
                          onChange={(e) =>
                            handleItemWeightChange(item.id, parseFloat(e.target.value) || 1)
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleRemoveItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
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
              <Input
                type="number"
                min="1"
                max="100"
                step="1"
                className="w-16 text-right"
                value={newItemWeight}
                onChange={(e) => setNewItemWeight(parseFloat(e.target.value) || 100)}
                placeholder="비중"
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
              비중(Weight)은 그룹 내 자산들의 상대적 비율입니다. 예: SGOV(50), SHY(50) = 1:1 배분
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
