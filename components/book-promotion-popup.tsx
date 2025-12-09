'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BookOpen, X, Sparkles, Gift, Zap, TrendingUp } from 'lucide-react'
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
      // Small delay for animation
      setTimeout(() => {
        setIsLoaded(true)
        // Trigger confetti after popup loads
        setTimeout(() => {
          setShowConfetti(true)
          // Stop confetti after 5 seconds
          setTimeout(() => setShowConfetti(false), 5000)
        }, 600)
      }, 100)
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
      {/* Confetti outside AnimatePresence to prevent flicker */}
      {showConfetti && (
        <div className="fixed inset-0 z-9999 pointer-events-none">
          <Confetti
            width={typeof window !== 'undefined' ? window.innerWidth : 1000}
            height={typeof window !== 'undefined' ? window.innerHeight : 800}
            recycle={false}
            numberOfPieces={500}
            gravity={0.3}
          />
        </div>
      )}

    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm"
          onClick={handleDismiss}
        >
          <motion.div
            initial={{ scale: 0.8, y: 50, opacity: 0 }}
            animate={{
              scale: isLoaded ? 1 : 0.8,
              y: isLoaded ? 0 : 50,
              opacity: isLoaded ? 1 : 0
            }}
            exit={{ scale: 0.8, y: 50, opacity: 0 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
            className="relative w-full max-w-[95vw] sm:max-w-md md:max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button - more visible on mobile */}
            <button
              onClick={handleDismiss}
              className="absolute top-2 right-2 sm:-top-2 sm:-right-2 z-10 p-2 sm:p-2.5 rounded-full bg-background/95 backdrop-blur-sm border-2 border-border shadow-xl hover:bg-muted transition-all duration-200 hover:scale-110 active:scale-95"
              aria-label="Close popup"
            >
              <X className="h-6 w-6 sm:h-5 sm:w-5 stroke-[2.5]" />
            </button>

            <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-primary/10 via-purple-500/10 to-pink-500/10 border-2 border-primary/20 shadow-2xl">
              {/* Animated background elements */}
              <div className="absolute inset-0 overflow-hidden">
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                    rotate: [0, 90, 0],
                    opacity: [0.3, 0.5, 0.3],
                  }}
                  transition={{
                    duration: 8,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="absolute -top-1/2 -right-1/2 w-full h-full bg-linear-to-br from-primary/20 to-purple-500/20 rounded-full blur-3xl"
                />
                <motion.div
                  animate={{
                    scale: [1.2, 1, 1.2],
                    rotate: [90, 0, 90],
                    opacity: [0.5, 0.3, 0.5],
                  }}
                  transition={{
                    duration: 8,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-linear-to-tr from-pink-500/20 to-purple-500/20 rounded-full blur-3xl"
                />
              </div>

              {/* Content */}
              <div className="relative bg-background/95 backdrop-blur-xl rounded-2xl p-4 sm:p-6 md:p-8 border border-border/50">
                {!showThankYou ? (
                  <>
                    {/* Header with icons */}
                    <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                      <motion.div
                        animate={{
                          rotate: [0, 10, -10, 10, 0],
                          scale: [1, 1.1, 1, 1.1, 1]
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          repeatDelay: 3
                        }}
                      >
                        <BookOpen className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
                      </motion.div>
                      <motion.div
                        animate={{
                          scale: [1, 1.2, 1],
                          opacity: [0.7, 1, 0.7]
                        }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                        }}
                      >
                        <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-500" />
                      </motion.div>
                    </div>

                    {/* Title with gradient */}
                    <h2 className="text-2xl sm:text-3xl font-bold text-center mb-2 bg-linear-to-r from-primary via-purple-600 to-pink-600 bg-clip-text text-transparent">
                      📚 Coming Soon!
                    </h2>

                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.3, type: "spring", bounce: 0.5 }}
                      className="text-center mb-4 sm:mb-6"
                    >
                      <h3 className="text-xl sm:text-2xl font-semibold mb-2 sm:mb-3 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                        <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-500 shrink-0" />
                        <span>The DevOps Survival Guide</span>
                        <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-green-500 shrink-0" />
                      </h3>
                      <p className="text-muted-foreground text-base sm:text-lg">
                        Your ultimate resource for mastering DevOps! 🚀
                      </p>
                    </motion.div>

                    {/* Feature highlights */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className="mb-4 sm:mb-6 space-y-2"
                    >
                      <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                        <div className="shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-linear-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-xs">✓</div>
                        <span>Expert tips & best practices 💡</span>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                        <div className="shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-linear-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white font-bold text-xs">✓</div>
                        <span>Real-world scenarios & solutions 🛠️</span>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                        <div className="shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-linear-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white font-bold text-xs">✓</div>
                        <span>Comprehensive guides & tutorials 📖</span>
                      </div>
                    </motion.div>

                    {/* Newsletter signup */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7 }}
                      className="bg-linear-to-br from-primary/5 to-purple-500/5 rounded-xl p-3 sm:p-4 md:p-5 border border-primary/20"
                    >
                      <div className="flex items-center gap-2 mb-2 sm:mb-3">
                        <Gift className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
                        <h4 className="font-semibold text-sm sm:text-base">Get Early Access & Updates! 🎉</h4>
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
                        Subscribe to be the first to know when the book launches + exclusive content! ✨
                      </p>

                      <form onSubmit={handleSubscribe} className="space-y-2 sm:space-y-3">
                        <input
                          type="email"
                          name="EMAIL"
                          id="mce-EMAIL"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="your@email.com"
                          required
                          className="w-full px-3 py-2.5 sm:px-4 sm:py-3 text-sm sm:text-base border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                        />

                        {/* Honeypot */}
                        <div style={{ position: 'absolute', left: '-5000px' }} aria-hidden="true">
                          <input type="text" name="b_d1128776b290ad8d08c02094f_fd76a4e93f" tabIndex={-1} defaultValue="" />
                        </div>

                        <Button
                          type="submit"
                          className="w-full bg-linear-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white font-semibold py-4 sm:py-5 md:py-6 text-sm sm:text-base rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
                        >
                          <Sparkles className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                          Yes! Keep Me Updated 🚀
                        </Button>
                      </form>
                    </motion.div>

                    {/* Maybe later button */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1 }}
                      className="mt-4 text-center"
                    >
                      <button
                        onClick={handleDismiss}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors underline"
                      >
                        Maybe later
                      </button>
                    </motion.div>
                  </>
                ) : (
                  /* Thank you message */
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-center py-6 sm:py-8"
                  >
                    <motion.div
                      animate={{
                        scale: [1, 1.2, 1],
                        rotate: [0, 360, 720]
                      }}
                      transition={{ duration: 1 }}
                      className="mb-3 sm:mb-4 flex justify-center"
                    >
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-linear-to-br from-green-500 to-emerald-600 flex items-center justify-center text-3xl sm:text-4xl">
                        🎉
                      </div>
                    </motion.div>
                    <h3 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-3">Thank You! ✨</h3>
                    <p className="text-sm sm:text-base text-muted-foreground mb-2">
                      You're all set! Check your inbox for confirmation. 📬
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      We'll keep you posted on the book launch! 🚀
                    </p>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  )
}
