import { useEffect, useRef } from 'react'

interface MintModalProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}

export function MintModal({ isOpen, onClose, children }: MintModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  // Handle click outside modal to close
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is on the backdrop (not on the modal content)
      if (backdropRef.current && event.target === backdropRef.current) {
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
    <div ref={backdropRef} className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 backdrop-blur-sm">
      {/* Modal content */}
      <div 
        ref={modalRef}
        className="relative max-w-2xl w-full mx-2 sm:mx-4 max-h-[85vh] bg-background card-cyber p-4 sm:p-8 overflow-hidden flex flex-col z-10"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2 sm:top-4 right-2 sm:right-4 text-text-secondary hover:text-accent transition-colors text-2xl font-bold z-10"
          aria-label="Close modal"
        >
          ×
        </button>
        
        {/* Scrollable content area */}
        <div className="overflow-y-auto pr-2" style={{ maxHeight: 'calc(85vh - 4rem)' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
