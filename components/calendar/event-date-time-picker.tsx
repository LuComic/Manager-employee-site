"use client"

import { useState } from "react"
import { enGB, et } from "date-fns/locale"
import { CalendarDays } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export function EventDateTimePicker({
  id,
  value,
  languageTag,
  dateAriaLabel,
  timeAriaLabel,
  disabled,
  onDateChange,
  onTimeChange,
  onTimeBlur,
}: {
  id: string
  value: string
  languageTag: string
  dateAriaLabel: string
  timeAriaLabel: string
  disabled?: boolean
  onDateChange: (value: string) => void
  onTimeChange: (value: string) => void
  onTimeBlur?: (value: string) => void
}) {
  return (
    <>
      <EventDatePicker
        id={id}
        value={value.slice(0, 10)}
        languageTag={languageTag}
        ariaLabel={dateAriaLabel}
        disabled={disabled}
        onChange={onDateChange}
      />
      <Label htmlFor={`${id}-time`} className="sr-only">
        {timeAriaLabel}
      </Label>
      <Input
        id={`${id}-time`}
        type="time"
        value={localTime(value)}
        aria-label={timeAriaLabel}
        disabled={disabled}
        onChange={(event) => onTimeChange(event.target.value)}
        onBlur={(event) => onTimeBlur?.(event.target.value)}
        className="mt-2 border border-input px-3"
      />
    </>
  )
}

export function EventDatePicker({
  id,
  value,
  minimum,
  languageTag,
  ariaLabel,
  disabled,
  onChange,
}: {
  id: string
  value: string
  minimum?: string
  languageTag: string
  ariaLabel: string
  disabled?: boolean
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = localDate(value)
  const minimumDate = minimum ? localDate(minimum) : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            className="w-full justify-start bg-background px-3 font-normal"
            aria-label={ariaLabel}
            disabled={disabled}
          />
        }
      >
        <CalendarDays />
        {selected
          ? new Intl.DateTimeFormat(languageTag, {
              dateStyle: "medium",
            }).format(selected)
          : ariaLabel}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          locale={languageTag === "et-EE" ? et : enGB}
          disabled={minimumDate ? { before: minimumDate } : undefined}
          onSelect={(date) => {
            if (!date) return
            onChange(localDateKey(date))
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

function localDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return undefined
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const result = new Date(year, month - 1, day)
  if (
    result.getFullYear() !== year ||
    result.getMonth() !== month - 1 ||
    result.getDate() !== day
  ) {
    return undefined
  }
  return result
}

function localDateKey(value: Date) {
  const year = String(value.getFullYear()).padStart(4, "0")
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function localTime(value: string) {
  const time = value.slice(11, 16)
  return /^\d{2}:\d{2}$/.test(time) ? time : ""
}
