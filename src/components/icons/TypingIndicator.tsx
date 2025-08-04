import React from 'react';

const TypingIndicator: React.FC = () => (
  <div className="flex items-center space-x-1">
    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" style={{ animationDelay: "0ms" }}></div>
    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" style={{ animationDelay: "200ms" }}></div>
    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" style={{ animationDelay: "400ms" }}></div>
  </div>
);

export default TypingIndicator;
