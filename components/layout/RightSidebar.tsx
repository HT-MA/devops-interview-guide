"use client"

import { ChatInput } from "@/components/ai/ChatInput"
import { QuickActions } from "@/components/ai/QuickActions"
import { AISummary } from "@/components/ai/AISummary"
import { RelatedCommands } from "@/components/ai/RelatedCommands"

export function RightSidebar() {
  return (
    <aside className="w-72 shrink-0 border-l border-[var(--border-subtle)] h-[calc(100vh-3rem)] sticky top-12 overflow-y-auto p-4 space-y-4 hidden xl:block">
      <ChatInput />
      <QuickActions />
      <AISummary />
      <RelatedCommands topic="kubernetes" />
    </aside>
  )
}
