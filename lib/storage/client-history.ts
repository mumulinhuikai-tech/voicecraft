/**
 * Client-side history storage using localStorage.
 * Works in all environments including Vercel serverless.
 */

import type { HistoryItem } from '@/types/tts'

const KEY = 'voicecraft_history'
const MAX_ITEMS = 50

export function saveHistory(items: HistoryItem[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX_ITEMS)))
  } catch { /* storage full — ignore */ }
}

export function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as HistoryItem[]) : []
  } catch { return [] }
}

export function addToHistory(item: HistoryItem): HistoryItem[] {
  const items = [item, ...loadHistory().filter((i) => i.id !== item.id)]
  saveHistory(items)
  return items
}

export function deleteFromHistory(id: string): HistoryItem[] {
  const items = loadHistory().filter((i) => i.id !== id)
  saveHistory(items)
  return items
}

export function clearHistoryStorage(): void {
  localStorage.removeItem(KEY)
}
