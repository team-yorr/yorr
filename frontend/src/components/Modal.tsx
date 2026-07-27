import { type ReactNode, useEffect, useId, useRef } from 'react'
import { cn } from '@/cn'

type ModalProps = {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
  className?: string
}

export function Modal({ children, className, onClose, open, title }: ModalProps) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)

  // 부모가 매 렌더 새 onClose를 넘겨도 포커스를 다시 뺏지 않도록 ref로 읽는다.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && onCloseRef.current()
    const previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.body.style.overflow = previousBodyOverflow
      previousFocus?.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-modal grid place-items-center p-4">
      <button
        className="absolute inset-0 cursor-default bg-black/70"
        type="button"
        aria-label="모달 닫기"
        onClick={onClose}
      />
      <section
        className={cn(
          'relative',
          'w-full max-w-lg rounded-panel border border-border bg-surface p-6 text-content shadow-raised',
          className,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="mb-4 flex items-center justify-between gap-4">
          <h2 className="m-0 text-xl font-bold" id={titleId}>
            {title}
          </h2>
          <button
            ref={closeRef}
            className="grid size-tap cursor-pointer place-items-center rounded-full bg-transparent text-2xl text-content focus-visible:outline-3 focus-visible:outline-focus"
            type="button"
            aria-label="닫기"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  )
}
