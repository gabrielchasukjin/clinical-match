import { motion } from 'framer-motion';

export const Greeting = () => {
  return (
    <div
      key="overview"
      className="max-w-5xl mx-auto size-full flex flex-col items-center justify-center px-8 scientific-background"
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.5 }}
        className="text-4xl md:text-5xl font-semibold text-center text-black mb-6"
      >
        Propel Clinical Research Forward
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.6 }}
        className="text-xl md:text-2xl text-center text-gray-600 max-w-3xl mb-8"
      >
        AI-powered matching that connects clinical trials<br />
        with qualified candidates in seconds
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.7 }}
        className="text-center text-sm text-gray-500 max-w-2xl"
      >
        💡 Paste your research paper abstract below, or upload an image/PDF using the 📎 button
      </motion.div>
    </div>
  );
};
