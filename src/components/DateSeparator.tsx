import React from 'react';

interface DateSeparatorProps {
  date: string;
}

const DateSeparator: React.FC<DateSeparatorProps> = ({ date }) => {
  return (
    <div className="py-4 my-2 flex items-center justify-center" aria-label={`Messages from ${date}`}>
      <div className="px-4 py-1 bg-neutral-200/80 dark:bg-neutral-800/80 rounded-full text-sm font-semibold text-neutral-600 dark:text-neutral-400 backdrop-blur-sm">
        {date}
      </div>
    </div>
  );
};

export default DateSeparator;