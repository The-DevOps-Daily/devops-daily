'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BookOpen, X, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Confetti from 'react-confetti'

export function BookPromotionPopup() {
  const [isVisible, setIsVisible] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [email, setEmail] = useState('')
  const [showThankYou, setShowThankYou] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)

  useEffect(() => {
    // Check if user has already dismissed or subscribed
    const dismissed = localStorage.getItem('book-promo-dismissed')
    const subscribed = localStorage.getItem('book-promo-subscribed')

    if (dismissed || subscribed) {
      return
    }

    // Show popup after 3 minutes to avoid being intrusive
    const timer = setTimeout(() => {
      setIsVisible(true)
      setTimeout(() => setIsLoaded(true), 100)
    }, 180000) // 3 minutes (180 seconds)

    return () => {
      clearTimeout(timer)
      setShowConfetti(false)
    }
  }, [])

  const handleDismiss = () => {
    setShowConfetti(false)
    setIsLoaded(false)
    setTimeout(() => {
      setIsVisible(false)
      localStorage.setItem('book-promo-dismissed', 'true')
    }, 300)
  }

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault()

    if (!email) return

    // Submit to Mailchimp
    const form = e.target as HTMLFormElement
    const formData = new FormData(form)

    // Open in new window (Mailchimp requirement)
    const mailchimpUrl = 'https://devops-daily.us2.list-manage.com/subscribe/post?u=d1128776b290ad8d08c02094f&id=fd76a4e93f&f_id=0022c6e1f0'
    const params = new URLSearchParams(formData as any).toString()
    window.open(`${mailchimpUrl}&${params}`, '_blank')

    // Show thank you message
    setShowThankYou(true)
    localStorage.setItem('book-promo-subscribed', 'true')

    // Show celebration confetti
    setShowConfetti(true)

    // Auto-close after 3 seconds
    setTimeout(() => {
      setShowConfetti(false)
      setIsLoaded(false)
      setTimeout(() => setIsVisible(false), 300)
    }, 3000)
  }

  if (!isVisible) return null

  return (
    <>
      {/* Confetti for celebration */}
      {showConfetti && (
        <div className="fixed inset-0 z-9999 pointer-events-none">
          <Confetti
            width={typeof window !== 'undefined' ? window.innerWidth : 1000}
            height={typeof window !== 'undefined' ? window.innerHeight : 800}
            recycle={false}
            numberOfPieces={300}
            gravity={0.3}
          />
        </div>
      )}

      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{
              x: isLoaded ? 0 : 400,
              opacity: isLoaded ? 1 : 0
            }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
            className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] sm:w-96 max-w-sm shadow-2xl"
          >
            {/* Compact card */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-background via-background to-primary/5 border-2 border-primary/20 shadow-2xl backdrop-blur-sm">
              {/* Close button */}
              <button
                onClick={handleDismiss}
                className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-background/95 backdrop-blur-sm border border-border shadow-lg hover:bg-muted transition-all duration-200 hover:scale-110 active:scale-95"
                aria-label="Close notification"
              >
                <X className="h-4 w-4 stroke-[2.5]" />
              </button>

              {/* Subtle glow effects */}
              <div className="absolute -top-10 -left-10 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
              <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl" />

              <div className="relative p-4">
                {!showThankYou ? (
                  <>
                    {/* Compact header */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="shrink-0 p-2 rounded-xl bg-gradient-to-br from-primary to-purple-600 shadow-lg">
                        <BookOpen className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0 pr-6">
                        <div className="flex items-center gap-1.5 mb-1">
                          <h3 className="text-base font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                            Free DevOps eBook
                          </h3>
                          <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Coming soon! Get early access 📚
                        </p>
                      </div>
                    </div>

                    {/* Newsletter signup */}
                    <div className="bg-gradient-to-br from-primary/5 to-purple-500/5 rounded-lg p-3 border border-primary/20">
                      <p className="text-xs text-muted-foreground mb-2.5">
                        Subscribe for exclusive content & launch updates! ✨
                      </p>

                      <form onSubmit={handleSubscribe} className="space-y-2">
                        <input
                          type="email"
                          name="EMAIL"
                          id="mce-EMAIL"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="your@email.com"
                          required
                          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                        />

                        {/* Honeypot */}
                        <div style={{ position: 'absolute', left: '-5000px' }} aria-hidden="true">
                          <input type="text" name="b_d1128776b290ad8d08c02094f_fd76a4e93f" tabIndex={-1} defaultValue="" />
                        </div>

                        <Button
                          type="submit"
                          className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white font-semibold py-2.5 text-sm rounded-lg transition-all duration-200 hover:shadow-lg"
                        >
                          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                          Subscribe 🚀
                        </Button>
                      </form>
                    </div>

                    {/* Maybe later */}
                    <div className="mt-2.5 text-center">
                      <button
                        onClick={handleDismiss}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
                      >
                        Maybe later
                      </button>
                    </div>
                  </>
                ) : (
                  /* Thank you message */
                  <div className="text-center py-4">
                    <div className="mb-2 flex justify-center">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-2xl">
                        🎉
                      </div>
                    </div>
                    <h3 className="text-lg font-bold mb-2">Thank You! ✨</h3>
                    <p className="text-sm text-muted-foreground mb-1">
                      Check your inbox! 📬
                    </p>
                    <p className="text-xs text-muted-foreground">
                      We'll notify you when it launches! 🚀
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
