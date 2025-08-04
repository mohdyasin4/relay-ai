import { MessagesSquare, Shield, Zap, Users } from "lucide-react";
import { LoginForm } from "@/components/login-form";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect } from "react";

export default function LoginPage() {
  const features = [
    {
      icon: Zap,
      title: "Smart Replies",
      description: "AI-powered suggestions that understand context and help you respond faster with more meaningful conversations that feel natural and engaging.",
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/20",
    },
    {
      icon: Shield,
      title: "Real-time Analysis",
      description: "Instant summarization and sentiment detection powered by advanced machine learning algorithms that understand the tone and context of your messages.",
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/20",
    },
    {
      icon: Users,
      title: "Seamless Sync",
      description: "Your conversations follow you everywhere with real-time synchronization across all devices, ensuring you never miss an important message.",
      color: "text-blue-400",
      bgColor: "bg-blue-500/20",
    },
    {
      icon: Shield,
      title: "Privacy First",
      description: "End-to-end encryption keeps you secure with military-grade protection, ensuring your personal conversations remain completely private and confidential.",
      color: "text-purple-400",
      bgColor: "bg-purple-500/20",
    },
  ];

  const [currentFeatureIndex, setCurrentFeatureIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setCurrentFeatureIndex((prev) => (prev + 1) % features.length);
    }, 3000); // Change feature every 3 seconds

    return () => clearInterval(interval);
  }, [features.length, isPaused]);

  return (
    <div className="bg-gradient-to-br from-background via-muted/30 to-muted/50 grid min-h-svh lg:grid-cols-3 overflow-hidden">
      {/* Signup/Login Form (Left) */}
      <motion.div
        className="flex flex-col gap-6 col-span-2 p-6 md:p-10"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <motion.div
          className="flex justify-center gap-2 md:justify-start"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <a
            href="#"
            className="flex items-center gap-3 font-semibold text-xl group transition-all duration-300 hover:scale-105"
          >
            <motion.div
              className="bg-gradient-to-br from-[#3B37FE] to-[#5B47FF] text-white flex size-8 items-center justify-center rounded-md shadow-lg shadow-[#3B37FE]/25"
              whileHover={{ rotate: 5, scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <MessagesSquare className="size-5" />
            </motion.div>
            <span className="text-foreground font-bold tracking-tight">
              Relay
            </span>
          </a>
        </motion.div>

        <motion.div
          className="flex flex-1 items-center justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="w-full max-w-lg">
            <motion.div
              className="backdrop-blur-sm rounded-2xl p-8 shadow-2xl shadow-black/5"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              whileHover={{ y: -2 }}
            >
              <LoginForm />
            </motion.div>
          </div>
        </motion.div>
      </motion.div>

      {/* Branding Content (Right Dark Panel) */}
     <motion.div 
        className="bg-gradient-to-br from-[#3B37FE] via-[#4C46FF] to-[#5B47FF] text-white p-10 rounded-2xl m-4 hidden lg:flex flex-col justify-between shadow-2xl shadow-[#3B37FE]/20 relative overflow-hidden"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
        
        <motion.div 
          className="relative z-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <Badge variant="secondary" className="border-slate-600/50 font-bold tracking-widest uppercase text-xs mb-6 backdrop-blur-sm">
              Relay
            </Badge>
          </motion.div>
          
          <motion.h1 
            className="text-6xl font-inter font-bold mt-4 leading-tight tracking-tight"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
          >
            Conversations.
            <br />
            <span className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              Reimagined.
            </span>
          </motion.h1>
          
          <motion.p 
            className="mt-6 text-slate-300 text-lg leading-relaxed font-medium"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            Relay is your AI-powered messaging companion. Smart, secure, and beautifully minimal.
            Stay connected like never before.
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.9 }}
          className="relative z-10"
        >
          <Card 
            className="mt-10 bg-slate-900 border-slate-700/50 backdrop-blur-md shadow-2xl transition-all duration-300 hover:bg-slate-900/50 hover:border-slate-600/50"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            <CardContent>
              {/* Animated Feature Display */}
              <div className="relative min-h-[120px] flex flex-col justify-center">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentFeatureIndex}
                    className="w-full"
                    initial={{ opacity: 0, y: 30, scale: 0.95 }}
                    animate={{ 
                      opacity: 1, 
                      y: 0, 
                      scale: 1,
                      transition: { 
                        duration: 0.6,
                        ease: "easeOut"
                      }
                    }}
                    exit={{ 
                      opacity: 0, 
                      y: -30, 
                      scale: 0.95,
                      transition: { 
                        duration: 0.4,
                        ease: "easeIn"
                      }
                    }}
                  >
                    <div className="flex items-start gap-4">
                      <motion.div
                        className={`p-3 rounded-2xl ${features[currentFeatureIndex].bgColor} ${features[currentFeatureIndex].color} border border-white/10`}
                        whileHover={{ scale: 1.1, rotate: 3 }}
                        transition={{ type: "spring", stiffness: 400, damping: 17 }}
                      >
                        {(() => {
                          const Icon = features[currentFeatureIndex].icon;
                          return <Icon className="size-6" />;
                        })()}
                      </motion.div>
                      
                      <div className="flex-1">
                        <h4 className="text-xl font-bold text-white mb-2">
                          {features[currentFeatureIndex].title}
                        </h4>
                        <p className="text-slate-300 text-base leading-relaxed">
                          {features[currentFeatureIndex].description}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
              
              {/* Progress Indicators */}
              <div className="flex justify-center gap-3 mt-8">
                {features.map((_, index) => (
                  <motion.button
                    key={index}
                    className={`relative w-12 h-3 rounded-full transition-all duration-300 overflow-hidden ${
                      index === currentFeatureIndex 
                        ? 'bg-slate-700/60 ring-2 ring-white' 
                        : 'bg-slate-700/40 hover:bg-slate-600/60'
                    }`}
                    onClick={() => setCurrentFeatureIndex(index)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {/* Active indicator with progress animation */}
                    {index === currentFeatureIndex && (
                      <motion.div
                        className="absolute inset-0 bg-white rounded-full origin-left"
                        initial={{ scaleX: 0 }}
                        animate={{ 
                          scaleX: isPaused ? 0 : 1,
                          transition: { 
                            duration: isPaused ? 0.3 : 3,
                            ease: "linear"
                          }
                        }}
                        key={`progress-${currentFeatureIndex}`}
                      />
                    )}
                    
                    {/* Static indicator for inactive states */}
                    <div className={`absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full transition-colors ${
                      index === currentFeatureIndex ? 'bg-white' : 'bg-slate-400'
                    }`} />
                  </motion.button>
                ))}
              </div>
              
              {/* Subtle hover instruction */}
              <motion.p
                className="text-center text-slate-400 text-xs mt-4 opacity-60"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                transition={{ delay: 2 }}
              >
                Hover to pause • Click dots to navigate
              </motion.p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
