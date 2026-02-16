'use client'

import { useState, useEffect } from 'react'
import { ArrowUp } from 'lucide-react'

export function BackToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const toggleVisibility = () => {
      // Show button after scrolling down 400px
      setVisible(window.scrollY > 400)
    }

    // Check on mount in case user refreshes mid-page
    toggleVisibility()

    window.addEventListener('scroll', toggleVisibility)
    return () => window.removeEventListener('scroll', toggleVisibility)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
   if (e.key === 'Enter' || e.key === ' ') {
     e.preventDefault()
     scrollToTop()
   }
 }

 if (!visible) return null

 return (
   <button
     onClick={scrollToTop}
     onKeyDown={handleKeyDown}
     aria-label="Back to top"
     className="
       fixed bottom-8 right-8 z-50
       p-3 rounded-full
       bg-primary text-primary-foreground
       shadow-lg hover:shadow-xl
       hover:bg-primary/90
       transition-all duration-200
       animate-in
       focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
       motion-reduce:transition-none
     "
   >
     <ArrowUp size={20} className="stroke-[2.5]" />
    </button>
  )
}
