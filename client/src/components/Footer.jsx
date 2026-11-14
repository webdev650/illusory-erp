import React from 'react';

export const Footer = () => {
  return (
    <footer className="w-full border-t border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-[#111520]/60 backdrop-blur-sm py-3 px-6 sm:px-8 mt-auto text-xs text-slate-500 dark:text-slate-400">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center space-x-1.5">
          <span>Made with</span>
          <span className="text-rose-500 text-sm">♥</span>
          <span>in India · Illusory ERP v1.0</span>
        </div>
        <div className="text-[11px] text-slate-400">
          <span>Illusory Design Studios Pvt. Ltd. (Bhubaneswar, Odisha)</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
