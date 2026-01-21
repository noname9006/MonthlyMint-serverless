import { useEffect, useRef } from 'react'

interface MintModalProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}

export function MintModal({ isOpen, onClose, children }: MintModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  // Handle click outside modal to close
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 backdrop-blur-sm">
      <div 
        ref={modalRef}
        className="relative max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto card-cyber p-8"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-text-secondary hover:text-accent transition-colors text-2xl font-bold"
          aria-label="Close modal"
        >
          ×
        </button>
        
        {children}
      </div>
    </div>
  )
}
