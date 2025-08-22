import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ForgotPasswordForm } from '@/components/forgot-password-form';

const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <motion.div 
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <ForgotPasswordForm onBack={handleBack} />
      </motion.div>
    </div>
  );
};

export default ForgotPasswordPage;


