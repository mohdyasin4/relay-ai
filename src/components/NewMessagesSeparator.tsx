import React from 'react';

const NewMessagesSeparator: React.FC = () => {
  return (
    <div className="relative py-4 my-2" aria-live="polite" aria-atomic="true">
      <hr className="absolute top-1/2 w-full border-t-2 border-dashed border-indigo-400 dark:border-indigo-600" />
      <div className="relative flex justify-center">
        <span className="px-3 bg-slate-100 dark:bg-slate-900 text-sm font-semibold text-indigo-600 dark:text-indigo-400 rounded-full">
          New Messages
        </span>
      </div>
    </div>
  );
};

export default NewMessagesSeparator;