import React from 'react'

export interface SourceItem {
  id?: string
  title: string
  url: string
  category?: string
}

interface MarkdownRendererProps {
  content: string
  sources?: SourceItem[]
}

export function MarkdownRenderer({ content, sources }: MarkdownRendererProps) {
  const blocks = parseBlocks(content)

  return (
    <div className="chat-markdown-body">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'heading': {
            const level = block.level || 3
            const headingContent = renderInline(block.content, sources)
            if (level === 1) return <h1 key={idx} className="chat-md-h chat-md-h1">{headingContent}</h1>
            if (level === 2) return <h2 key={idx} className="chat-md-h chat-md-h2">{headingContent}</h2>
            return <h3 key={idx} className="chat-md-h chat-md-h3">{headingContent}</h3>
          }

          case 'table': {
            return (
              <div key={idx} className="chat-table-wrapper">
                <table className="chat-md-table">
                  <thead>
                    <tr>
                      {block.headers.map((h, i) => (
                        <th key={i}>{renderInline(h, sources)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td key={j}>{renderInline(cell, sources)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }

          case 'ul': {
            return (
              <ul key={idx} className="chat-md-ul">
                {block.items.map((item, i) => (
                  <li key={i}>{renderInline(item, sources)}</li>
                ))}
              </ul>
            )
          }

          case 'ol': {
            return (
              <ol key={idx} className="chat-md-ol">
                {block.items.map((item, i) => (
                  <li key={i}>{renderInline(item, sources)}</li>
                ))}
              </ol>
            )
          }

          case 'code': {
            return (
              <pre key={idx} className="chat-md-pre">
                <code>{block.content}</code>
              </pre>
            )
          }

          case 'paragraph':
          default: {
            if (!block.content.trim()) return null
            return (
              <p key={idx} className="chat-md-p">
                {renderInline(block.content, sources)}
              </p>
            )
          }
        }
      })}
    </div>
  )
}

type Block =
  | { type: 'heading'; level: number; content: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'code'; content: string }
  | { type: 'paragraph'; content: string }

function parseBlocks(raw: string): Block[] {
  const lines = raw.split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Code block
    if (line.trim().startsWith('```')) {
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++
      blocks.push({ type: 'code', content: codeLines.join('\n') })
      continue
    }

    // Heading (# ## ###)
    const headingMatch = line.trim().match(/^(#{1,6})\s+(.*)$/)
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        content: headingMatch[2],
      })
      i++
      continue
    }

    // Markdown Table (detect line with | ... |)
    if (isTableLine(line)) {
      const tableLines: string[] = []
      while (i < lines.length && isTableLine(lines[i])) {
        tableLines.push(lines[i])
        i++
      }

      const parsedTable = parseTableLines(tableLines)
      if (parsedTable) {
        blocks.push(parsedTable)
        continue
      }
      // If table parsing failed, fallback to normal processing
    }

    // Unordered List (- or * or +)
    if (isUlLine(line)) {
      const items: string[] = []
      while (i < lines.length && isUlLine(lines[i])) {
        items.push(lines[i].trim().replace(/^[-*+]\s+/, ''))
        i++
      }
      blocks.push({ type: 'ul', items })
      continue
    }

    // Ordered List (1. 2.)
    if (isOlLine(line)) {
      const items: string[] = []
      while (i < lines.length && isOlLine(lines[i])) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''))
        i++
      }
      blocks.push({ type: 'ol', items })
      continue
    }

    // Paragraph
    if (line.trim()) {
      const pLines: string[] = []
      while (
        i < lines.length &&
        lines[i].trim() &&
        !lines[i].trim().startsWith('```') &&
        !lines[i].trim().match(/^#{1,6}\s+/) &&
        !isTableLine(lines[i]) &&
        !isUlLine(lines[i]) &&
        !isOlLine(lines[i])
      ) {
        pLines.push(lines[i].trim())
        i++
      }
      blocks.push({ type: 'paragraph', content: pLines.join(' ') })
      continue
    }

    i++
  }

  return blocks
}

function isTableLine(line: string): boolean {
  const trimmed = line.trim()
  return (trimmed.startsWith('|') && trimmed.endsWith('|')) || (trimmed.includes('|') && trimmed.includes('---'))
}

function isUlLine(line: string): boolean {
  return /^\s*[-*+]\s+/.test(line)
}

function isOlLine(line: string): boolean {
  return /^\s*\d+\.\s+/.test(line)
}

function parseTableLines(lines: string[]): { type: 'table'; headers: string[]; rows: string[][] } | null {
  if (lines.length < 2) return null

  const cleanCells = (rowStr: string) =>
    rowStr
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map(c => c.trim())

  const headers = cleanCells(lines[0])

  let startRowIdx = 1
  // Check if line 2 is a separator like |---|---|
  if (lines[1].includes('---')) {
    startRowIdx = 2
  }

  const rows: string[][] = []
  for (let idx = startRowIdx; idx < lines.length; idx++) {
    const rowCells = cleanCells(lines[idx])
    if (rowCells.length > 0 && rowCells.some(c => c.length > 0)) {
      rows.push(rowCells)
    }
  }

  return { type: 'table', headers, rows }
}

/**
 * Render inline formatting (bold, italic, code, citation badges [1] or 【1】)
 */
function renderInline(text: string, sources?: SourceItem[]): React.ReactNode[] {
  if (!text) return []

  // Tokenize string for citations, bold, italic, code
  // Regex matches:
  // 1. Citations: \[\d+\] or 【\d+】
  // 2. Bold: \*\*.*?\*\*
  // 3. Italic: \*.*?\* or _.*?_
  // 4. Code: `.*?`
  const regex = /(\[\d+\]|【\d+】|\*\*.*?\*\*|\*.*?\*|_.*?_|`.*?`)/g
  const parts = text.split(regex)

  return parts.map((part, idx) => {
    if (!part) return null

    // Citation badge [1] or 【1】
    const citationMatch = part.match(/^(\[(\d+)\]|【(\d+)】)$/)
    if (citationMatch) {
      const numVal = parseInt(citationMatch[2] || citationMatch[3], 10)
      const source = sources && sources[numVal - 1]
      if (source) {
        return (
          <a
            key={idx}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="chat-citation-pill"
            title={source.title}
          >
            <span className="chat-citation-dot" />
            <span className="chat-citation-title">
              {source.title.length > 18 ? `${source.title.slice(0, 18)}…` : source.title}
            </span>
          </a>
        )
      }
      return (
        <span key={idx} className="chat-citation-pill" title={`Source [${numVal}]`}>
          <span className="chat-citation-dot" />
          <span className="chat-citation-title">Source {numVal}</span>
        </span>
      )
    }

    // Bold **text**
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>
    }

    // Italic *text* or _text_
    if ((part.startsWith('*') && part.endsWith('*') && part.length > 2) || (part.startsWith('_') && part.endsWith('_') && part.length > 2)) {
      return <em key={idx}>{part.slice(1, -1)}</em>
    }

    // Inline code `text`
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={idx} className="chat-md-inline-code">
          {part.slice(1, -1)}
        </code>
      )
    }

    return part
  })
}
