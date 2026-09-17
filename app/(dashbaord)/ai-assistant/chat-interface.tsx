'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { askAIAssistant } from './actions'

type ChatMessage = {
  id: string
  sender: 'user' | 'assistant'
  content: string
  toolUsed?: string
  timestamp: string
}

type PromptCategory = {
  id: string
  label: string
  icon: string
  prompts: string[]
}

const PROMPT_CATEGORIES: PromptCategory[] = [
  {
    id: 'stock',
    label: 'Inventory & Stock',
    icon: '📦',
    prompts: [
      'What products are low in stock?',
      'Show me dead stock in all branches.',
      'Which items are below reorder threshold?',
    ],
  },
  {
    id: 'finance',
    label: 'Profitability & COGS',
    icon: '💰',
    prompts: [
      'What is my profitability?',
      'Summarize current month operating margin and COGS.',
    ],
  },
  {
    id: 'suppliers',
    label: 'Suppliers & Payables',
    icon: '🚚',
    prompts: [
      'Which suppliers have overdue payments?',
      'List pending purchase orders and liabilities.',
    ],
  },
  {
    id: 'reports',
    label: 'Executive Reports',
    icon: '📑',
    prompts: [
      'Generate my executive report for August 2026.',
      'Provide an executive performance audit.',
    ],
  },
]

export default function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      content: `### 👋 Welcome to RetailPilot AI
I am your **Autonomous Retail Intelligence Assistant**, directly integrated with your live PostgreSQL inventory ledger and multi-tenant **Model Context Protocol (MCP)** tool server.

#### Operational Capabilities Available:
* **Predictive Stock Audits**: Real-time deficit scanning against configured reorder thresholds.
* **Dead Stock Detection**: Identifying idle capital tied up in zero-movement inventory.
* **Financial Profitability & COGS**: Live margin synthesis combining sales, purchase costs, and expenses.
* **Supplier Liability Escalations**: Tracking overdue invoices and payables.
* **Executive Report Synthesis**: Generating formal monthly performance dossiers.

> ⚠️ Mandatory Notice: All recommendations are AI-assisted operational projections derived from immutable ledger movements. Always verify high-capital purchasing decisions against store inventory audits.`,
      timestamp: 'Ready',
    },
  ])

  const [input, setInput] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('stock')
  const [isPending, startTransition] = useTransition()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messageCounterRef = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isPending])

  const handleSendMessage = (textToSend?: string) => {
    const query = (textToSend ?? input).trim()
    if (!query || isPending) return

    messageCounterRef.current += 1
    const currentMsgId = messageCounterRef.current

    const userMessage: ChatMessage = {
      id: `usr-${currentMsgId}`,
      sender: 'user',
      content: query,
      timestamp: new Intl.DateTimeFormat('en-IN', { timeStyle: 'short' }).format(new Date()),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')

    startTransition(async () => {
      try {
        const response = await askAIAssistant(query)
        messageCounterRef.current += 1
        const assistantMessage: ChatMessage = {
          id: `ai-${messageCounterRef.current}`,
          sender: 'assistant',
          content: response.content,
          toolUsed: response.toolUsed,
          timestamp: new Intl.DateTimeFormat('en-IN', { timeStyle: 'short' }).format(new Date()),
        }
        setMessages((prev) => [...prev, assistantMessage])
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Operational server error'
        messageCounterRef.current += 1
        const errorAssistantMessage: ChatMessage = {
          id: `ai-err-${messageCounterRef.current}`,
          sender: 'assistant',
          content: `### ⚠️ Request Processing Error\nUnable to fulfill query via MCP runtime: ${errorMessage}\n\nPlease verify that your staff account possesses active inventory and operational permissions.`,
          timestamp: 'Failed',
        }
        setMessages((prev) => [...prev, errorAssistantMessage])
      }
    })
  }

  const handleClearChat = () => {
    setMessages([
      {
        id: 'reset',
        sender: 'assistant',
        content: `### 🔄 Session Cleared\nAsk me any operational question regarding inventory deficits, dead stock, profitability, or executive performance.`,
        timestamp: 'Reset',
      },
    ])
    inputRef.current?.focus()
  }

  // Parse markdown tables and lines into high-fidelity UI elements
  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n')
    const elements: React.ReactNode[] = []
    let tableBuffer: string[] = []
    let inTable = false

    const flushTable = (keyPrefix: number) => {
      if (tableBuffer.length < 2) {
        tableBuffer = []
        return
      }

      const headerRow = tableBuffer[0]
        .split('|')
        .map((c) => c.trim())
        .filter((c) => c.length > 0)

      const bodyRows = tableBuffer
        .slice(2)
        .map((row) =>
          row
            .split('|')
            .map((c) => c.trim())
            .filter((c) => c.length > 0)
        )
        .filter((row) => row.length > 0)

      elements.push(
        <div key={`table-${keyPrefix}`} className="my-3 w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain rounded-xl border border-slate-200 bg-white shadow-2xs" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="min-w-[400px] w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                {headerRow.map((col, cIdx) => (
                  <th key={cIdx} className="px-3.5 py-2.5 whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bodyRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-50/60 transition-colors">
                  {row.map((cell, cellIdx) => (
                    <td key={cellIdx} className="px-3.5 py-2 text-slate-800 whitespace-nowrap font-mono">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      tableBuffer = []
    }

    lines.forEach((line, idx) => {
      // Table line detection
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        inTable = true
        tableBuffer.push(line)
        return
      } else if (inTable) {
        inTable = false
        flushTable(idx)
      }

      // Headings
      if (line.startsWith('### ')) {
        elements.push(
          <h3 key={idx} className="text-base font-bold text-slate-900 mt-4 mb-2 first:mt-0 flex items-center gap-2">
            <span>{line.replace('### ', '')}</span>
          </h3>
        )
        return
      }
      if (line.startsWith('#### ')) {
        elements.push(
          <h4 key={idx} className="text-sm font-semibold text-slate-800 mt-3 mb-1">
            {line.replace('#### ', '')}
          </h4>
        )
        return
      }

      // Mandatory Notice / Alert Box
      if (line.startsWith('> ⚠️ ') || line.startsWith('> ')) {
        const text = line.replace(/^>\s*(?:⚠️\s*)?/, '')
        elements.push(
          <div
            key={idx}
            className="my-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-950 flex items-start gap-2.5 shadow-2xs"
          >
            <span className="text-amber-600 text-sm mt-0.5">⚠️</span>
            <div>
              <strong className="font-semibold block text-amber-900">Mandatory Notice:</strong>
              <span>{text}</span>
            </div>
          </div>
        )
        return
      }

      // Bullet points & AI-generated recommendation badge
      if (line.startsWith('* ') || line.startsWith('- ')) {
        const rawBullet = line.slice(2)
        const isRecommendation =
          rawBullet.toLowerCase().includes('recommendation') ||
          rawBullet.toLowerCase().includes('recommended') ||
          rawBullet.toLowerCase().includes('suggest')

        elements.push(
          <div
            key={idx}
            className={`my-1.5 flex items-start gap-2 text-xs leading-relaxed ${
              isRecommendation
                ? 'rounded-lg bg-indigo-50/70 border border-indigo-100 p-2.5 text-indigo-950'
                : 'text-slate-700 pl-1.5'
            }`}
          >
            {isRecommendation ? (
              <span className="inline-flex items-center gap-1 rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider shrink-0 mt-0.5">
                AI Recommendation
              </span>
            ) : (
              <span className="text-indigo-600 font-bold shrink-0 mt-0.5">•</span>
            )}
            <span className="flex-1">
              {rawBullet.split('**').map((part, pIdx) =>
                pIdx % 2 === 1 ? (
                  <strong key={pIdx} className="font-semibold text-slate-900">
                    {part}
                  </strong>
                ) : (
                  part
                )
              )}
            </span>
          </div>
        )
        return
      }

      // Empty line spacer
      if (line.trim() === '') {
        elements.push(<div key={idx} className="h-1.5" />)
        return
      }

      // Normal paragraph
      elements.push(
        <p key={idx} className="text-xs text-slate-700 leading-relaxed">
          {line.split('**').map((part, pIdx) =>
            pIdx % 2 === 1 ? (
              <strong key={pIdx} className="font-semibold text-slate-900">
                {part}
              </strong>
            ) : (
              part
            )
          )}
        </p>
      )
    })

    if (inTable && tableBuffer.length > 0) {
      flushTable(999999)
    }

    return <div className="space-y-1">{elements}</div>
  }

  return (
    <div className="flex flex-col h-[650px] sm:h-[740px] w-full min-w-0 max-w-full rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
      {/* Top Banner with Stitch Design Aesthetics */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 bg-slate-50/80 px-4 sm:px-6 py-3 sm:py-3.5 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white shadow-xs">
            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 truncate">RetailPilot Live Copilot</h2>
              <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 border border-indigo-200 shrink-0">
                Model Context Protocol v2
              </span>
            </div>
            <p className="text-[11px] text-slate-500 truncate">Live PostgreSQL ledger query & analytics synthesis</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:inline">MCP Tools Online</span>
            <span className="sm:hidden">Online</span>
          </div>

          <button
            type="button"
            onClick={handleClearChat}
            title="Reset conversation"
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-2xs"
          >
            Clear Session
          </button>
        </div>
      </div>

      {/* Messages Scroll Feed */}
      <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-4 bg-slate-50/30">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.sender === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            {/* Header: Sender & Timestamp */}
            <div className="flex items-center gap-2 mb-1 px-1.5 text-[11px] text-slate-400">
              <span className="font-semibold text-slate-700">
                {msg.sender === 'user' ? 'You' : 'RetailPilot Copilot'}
              </span>
              <span>•</span>
              <span>{msg.timestamp}</span>
              {msg.toolUsed && (
                <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-mono font-medium text-indigo-700 border border-indigo-200">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  </svg>
                  MCP: {msg.toolUsed}
                </span>
              )}
            </div>

            {/* Bubble */}
            <div
              className={`rounded-2xl p-3.5 sm:p-5 max-w-full sm:max-w-3xl min-w-0 break-words shadow-xs transition-all ${
                msg.sender === 'user'
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-tr-xs shadow-indigo-500/10'
                  : 'bg-white border border-slate-200 text-slate-800 rounded-tl-xs shadow-slate-200/50'
              }`}
            >
              {msg.sender === 'user' ? (
                <p className="text-sm font-medium leading-relaxed">{msg.content}</p>
              ) : (
                renderFormattedContent(msg.content)
              )}
            </div>
          </div>
        ))}

        {/* Loading Indicator */}
        {isPending && (
          <div className="flex flex-col items-start space-y-1 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 mb-1 px-1.5 text-[11px] text-slate-400">
              <span className="font-semibold text-slate-700">RetailPilot Copilot</span>
              <span>•</span>
              <span className="text-indigo-600 font-medium">Invoking MCP Server Tool...</span>
            </div>
            <div className="rounded-2xl rounded-tl-xs bg-white border border-slate-200 px-5 py-3.5 shadow-xs flex items-center gap-3">
              <div className="flex space-x-1.5">
                <div className="h-2 w-2 rounded-full bg-indigo-600 animate-bounce [animation-delay:-0.3s]" />
                <div className="h-2 w-2 rounded-full bg-indigo-600 animate-bounce [animation-delay:-0.15s]" />
                <div className="h-2 w-2 rounded-full bg-indigo-600 animate-bounce" />
              </div>
              <span className="text-xs font-medium text-slate-600">
                Querying store database & analyzing inventory metrics...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Categorized Suggested Prompts Section */}
      <div className="border-t border-slate-100 bg-white px-3.5 sm:px-6 py-2.5 space-y-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider shrink-0 mr-1">
            Suggested:
          </span>
          {PROMPT_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition shrink-0 ${
                activeCategory === cat.id
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 border border-transparent'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Selected Category Prompt Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {PROMPT_CATEGORIES.find((c) => c.id === activeCategory)?.prompts.map((prompt, i) => (
            <button
              key={i}
              type="button"
              disabled={isPending}
              onClick={() => handleSendMessage(prompt)}
              className="shrink-0 rounded-full border border-slate-200 bg-slate-50/70 px-3 py-1 text-xs text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Input Form Toolbar */}
      <div className="border-t border-slate-200 bg-white p-3 sm:p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSendMessage()
          }}
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5"
        >
          <div className="relative flex-1 min-w-0">
            <input
              ref={inputRef}
              type="text"
              aria-label="Ask RetailPilot Copilot a question"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isPending}
              placeholder="Ask Copilot about low stock, dead stock, profitability, supplier payables..."
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 sm:px-4 py-2.5 sm:py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50 transition"
            />
          </div>

          <button
            type="submit"
            disabled={isPending || !input.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 sm:py-3 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 active:bg-indigo-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-indigo-300 disabled:cursor-not-allowed transition w-full sm:w-auto shrink-0"
          >
            {isPending ? (
              <>
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Thinking...</span>
              </>
            ) : (
              <>
                <span>Ask Copilot</span>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </>
            )}
          </button>
        </form>
        <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 px-1 text-[11px] text-slate-400">
          <span>Press ↵ Enter to submit query</span>
          <span>Security: Multi-tenant RBAC enforced · Customer data isolated</span>
        </div>
      </div>
    </div>
  )
}
