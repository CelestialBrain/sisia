import { useState, useEffect } from 'react';

export function useChatTimer() {
  const [timeLeft, setTimeLeft] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      
      // Convert to Philippine Time (UTC+8)
      const phtOffset = 8 * 60; // minutes
      const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
      const phtTime = new Date(utcTime + (phtOffset * 60000));
      
      // Set next 8 AM PHT
      let next8AM = new Date(phtTime);
      next8AM.setHours(8, 0, 0, 0);
      
      // If current time is past 8 AM, set to next day
      if (phtTime >= next8AM) {
        next8AM.setDate(next8AM.getDate() + 1);
      }
      
      const diff = next8AM.getTime() - phtTime.getTime();
      
      // Check if within 1 second of reset
      if (diff < 1000) {
        setIsResetting(true);
        setTimeout(() => setIsResetting(false), 3000);
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    };
    
    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  return { timeLeft, isResetting };
}
