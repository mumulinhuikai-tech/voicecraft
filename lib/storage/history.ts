/**
 * Local JSON-based history storage.
 *
 * MVP: Reads/writes a JSON file at data/history.json.
 * Future: Replace with SQLite (better-sqlite3) or a database adapter
 * by swapping the implementation of these functions only.
 */

import fs from 'fs'
import path from 'path'
import type { HistoryItem } from '@/types/tts'

const DATA_DIR = path.join(process.cwd(), 'data')
const HISTORY_FILE = path.join(DATA_DIR, 'history.json')
const MAX_HISTORY_ITEMS = 100

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

function readHistory(): HistoryItem[] {
  ensureDataDir()
  if (!fs.existsSync(HISTORY_FILE)) return []
  try {
    const raw = fs.readFileSync(HISTORY_FILE, 'utf-8')
    return JSON.parse(raw) as HistoryItem[]
  } catch {
    return []
  }
}

function writeHistory(items: HistoryItem[]): void {
  ensureDataDir()
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(items, null, 2), 'utf-8')
}

export function addHistoryItem(item: HistoryItem): void {
  const items = readHistory()
  items.unshift(item) // newest first
  // Keep storage bounded
  const trimmed = items.slice(0, MAX_HISTORY_ITEMS)
  writeHistory(trimmed)
}

export function getHistory(): HistoryItem[] {
  return readHistory()
}

export function deleteHistoryItem(id: string): boolean {
  const items = readHistory()
  const filtered = items.filter((i) => i.id !== id)
  if (filtered.length === items.length) return false
  writeHistory(filtered)
  return true
}

export function clearHistory(): void {
  writeHistory([])
}
