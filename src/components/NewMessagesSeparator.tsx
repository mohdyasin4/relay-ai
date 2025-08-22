import React from 'react';

import { motion } from "motion/react";

const NewMessagesSeparator: React.FC = () => {
  return (
    <motion.div 
      className="relative py-6 my-4" 
      aria-live="polite" 
      aria-atomic="true"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <hr className="absolute top-1/2 w-full border-t-2 border-dashed border-primary/30 dark:border-primary/40" />
      <div className="relative flex justify-center">
        <motion.span 
          className="px-4 py-2 bg-gradient-to-r from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 text-sm font-semibold text-primary dark:text-primary/90 rounded-full border border-primary/20 dark:border-primary/30 shadow-sm backdrop-blur-sm"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          ✨ New Messages
        </motion.span>
      </div>
    </motion.div>
  );
};

export default NewMessagesSeparator;