import React, { useState } from 'react';
import type { User } from '../types';
import CheckIcon from './icons/CheckIcon';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface OnboardingProps {
  onComplete: (user: User) => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [name, setName] = useState('');
  const [gmailConnected, setGmailConnected] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName) {
      onComplete({ id: trimmedName, name: trimmedName });
    }
  };

  return (
    <div className="h-screen w-screen bg-slate-950 flex items-center justify-center font-sans antialiased p-4">
      <div className="w-full max-w-md bg-slate-900 p-8 rounded-2xl shadow-2xl text-slate-200">
        <h1 className="text-3xl font-bold text-center mb-2 text-white">Welcome to Gemini Messenger</h1>
        <p className="text-slate-400 text-center mb-8">Let's get you set up.</p>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label htmlFor="name" className="block mb-2 text-sm font-medium text-slate-300">What should we call you?</label>
            <Input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5"
              placeholder="e.g., Alex"
              required
            />
          </div>

          <div className="mb-8">
             <label className="block mb-2 text-sm font-medium text-slate-300">Connect your accounts</label>
             <Button
                onClick={() => setGmailConnected(true)}
                disabled={gmailConnected}
                className="w-full text-left p-3 flex items-center gap-3 rounded-lg bg-slate-800 hover:bg-slate-700/50 transition-colors disabled:bg-slate-700/50"
             >
                <svg className="w-6 h-6" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path><path fill="none" d="M0 0h48v48H0z"></path></svg>
                <span className="flex-1 font-semibold">{gmailConnected ? 'Gmail Connected!' : 'Connect Gmail'}</span>
                {gmailConnected && <CheckIcon className="w-6 h-6 text-green-400" />}
             </Button>
             <p className="text-xs text-slate-500 mt-2 px-1">(This is a demonstration and does not actually access your account.)</p>
          </div>
          
          <Button variant="outline" disabled={!name.trim()}>
            Start Chatting
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Onboarding;