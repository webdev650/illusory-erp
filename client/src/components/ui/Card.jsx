import React from 'react';

export const Card = ({
  children,
  className = '',
  hover = false,
  padding = 'p-5 sm:p-6',
  ...props
}) => {
  return (
    <div
      className={`bg-white dark:bg-[#151A26] rounded-card border border-slate-100/80 dark:border-slate-800 shadow-soft transition-all duration-200 ${
        hover ? 'hover:shadow-soft-md hover:border-slate-200 dark:hover:border-slate-700' : ''
      } ${padding} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;

