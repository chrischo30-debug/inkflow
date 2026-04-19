'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type DepositType = 'fixed' | 'percentage' | 'custom'

interface DepositSelectorProps {
  defaultType?: DepositType
  defaultAmount?: number
  defaultValue?: number
  defaultNote?: string
}

export function DepositSelector({ 
  defaultType = 'fixed',
  defaultAmount = 0,
  defaultValue = 25,
  defaultNote = ''
}: DepositSelectorProps) {
  const [depositType, setDepositType] = useState<DepositType>(defaultType)

  return (
    <div className="space-y-3">
      {/* Hidden field carries the type */}
      <input type="hidden" name="deposit_type" value={depositType} />

      {/* Type selector tabs */}
      <div className="flex gap-2">
        {(['fixed', 'percentage', 'custom'] as DepositType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setDepositType(type)}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              depositType === type
                ? 'bg-primary text-on-primary border-primary'
                : 'bg-surface-container-high/40 text-on-surface-variant border-outline-variant hover:bg-surface-container-high'
            }`}
          >
            {type === 'fixed' && 'Fixed ($)'}
            {type === 'percentage' && '% of Quote'}
            {type === 'custom' && 'Custom'}
          </button>
        ))}
      </div>

      {/* Conditional value input */}
      {depositType === 'fixed' && (
        <div className="flex items-center gap-2">
          <span className="text-on-surface-variant px-3 py-2 bg-surface-container-high rounded-lg border-b border-outline-variant text-sm">$</span>
          <Input
            name="deposit_amount"
            type="number"
            min="0"
            step="1"
            placeholder="100"
            defaultValue={defaultAmount || ''}
            className="flex-1"
          />
        </div>
      )}

      {depositType === 'percentage' && (
        <div className="flex items-center gap-2">
          <Input
            name="deposit_percentage"
            type="number"
            min="1"
            max="100"
            step="1"
            placeholder="25"
            defaultValue={defaultValue || ''}
            className="flex-1"
          />
          <span className="text-on-surface-variant px-3 py-2 bg-surface-container-high rounded-lg border-b border-outline-variant text-sm">%</span>
        </div>
      )}

      {depositType === 'custom' && (
        <Textarea
          name="deposit_note"
          placeholder="e.g. Deposit varies by tattoo size and placement. Half-day sessions require $200, full sleeves require $500."
          defaultValue={defaultNote || ''}
          rows={3}
          className="resize-none"
        />
      )}

      <p className="text-xs text-on-surface-variant/70">
        {depositType === 'fixed' && 'A flat dollar amount collected before the session.'}
        {depositType === 'percentage' && 'A percentage of the quoted price collected upfront.'}
        {depositType === 'custom' && 'Describe your policy in your own words. This will be shown to clients.'}
      </p>
    </div>
  )
}
