"use client"

import { useRef, memo } from "react"
import Link from "next/link"
import { motion, useInView } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ArrowRightIcon } from "lucide-react"
import { SparklesCore } from "../animation/sparkles"
import { GlowingButton } from "../custom/glowing-button"


 function CtaSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <section ref={ref} className="relative overflow-hidden py-24">
      {/* Sparkles effect */}
      <div className="absolute inset-0 h-full w-full">
        <SparklesCore
          id="tsparticlesfullpage2"
          background="transparent"
          minSize={0.6}
          maxSize={1.4}
          particleDensity={70}
          className="h-full w-full"
          particleColor="#7928CA"
        />
      </div>

      <div className="container relative z-10 px-4 mx-auto">
        <div className="mx-auto max-w-3xl text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5 }}
            className="mb-6 text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl"
          >
            Ready to understand GitHub repositories like never before?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-10 text-lg text-muted-foreground"
          >
            Join thousands of developers who use GitInsight to make sense of code changes, understand project history,
            and collaborate more effectively.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Link href="/signup">
              <GlowingButton className="rounded-full gap-2 group">
                Get started for free
                <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </GlowingButton>
            </Link>
            <Link href="#demo">
              <Button variant="outline" size="lg" className="rounded-full">
                See how it works
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  )
}


export default memo(CtaSection)