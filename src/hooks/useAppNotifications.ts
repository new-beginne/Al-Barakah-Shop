import { useEffect } from 'react';
import { db } from '../db/db';

export function useAppNotifications() {
  useEffect(() => {
    // Request permission automatically
    const requestPermission = async () => {
      if ('Notification' in window && Notification.permission === 'default') {
        try {
          await Notification.requestPermission();
        } catch (e) {
          console.warn('Notification permission request failed', e);
        }
      }
    };
    
    requestPermission();

    const checkAndNotify = async () => {
      const lastNotified = localStorage.getItem('albarakah_last_notified');
      const now = Date.now();
      
      // If it's the very first time, set the timer for 1 hour from now instead of immediately spamming
      if (!lastNotified) {
        localStorage.setItem('albarakah_last_notified', now.toString());
        return;
      }
      
      // 1 hour = 60 * 60 * 1000 = 3600000 ms
      if (now - parseInt(lastNotified, 10) >= 3600000) {
        
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            // Check for pending dues and overdue borrowings
            const allDues = await db.dues.toArray();
            const totalDue = allDues.reduce((acc, due) => acc + (due.totalAmount - due.paidAmount), 0);
            
            const allBorrowings = await db.borrowings.where('status').notEqual('Paid').toArray();
            const nowTimeDate = new Date();
            let overdueBorrowingsTotal = 0;
            
            allBorrowings.forEach(b => {
              const dueTime = new Date(b.dueDate);
              if (dueTime < nowTimeDate && dueTime.toDateString() !== nowTimeDate.toDateString()) {
                overdueBorrowingsTotal += (b.amount - b.paidAmount);
              }
            });

            let body = 'Did you forget to add any recent sales or expenses?';
            if (overdueBorrowingsTotal > 0) {
              body = `WARNING: You have Tk ${overdueBorrowingsTotal.toLocaleString()} in OVERDUE borrowings! Please pay your lenders.`;
            } else if (totalDue > 0) {
              body = `You have Tk ${totalDue.toLocaleString()} in pending dues. Did you collect any? Also, remember to log your sales!`;
            }

            const title = 'Al-Barakah Reminder';

            // Store in IndexedDB
            const nowTime = new Date();
            await db.notifications.add({
              date: nowTime.toISOString().split('T')[0],
              time: nowTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
              createdAt: nowTime.toISOString(),
              title,
              message: body,
              isRead: false,
              type: 'reminder'
            });

            // Using service worker registration for better mobile PWA support
            if ('serviceWorker' in navigator) {
              const reg = await navigator.serviceWorker.ready;
              reg.showNotification(title, {
                body,
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                vibrate: [200, 100, 200]
              } as NotificationOptions);

              // Also try to register periodic sync for background execution
              try {
                if ('periodicSync' in reg) {
                  const status = await navigator.permissions.query({
                    name: 'periodic-background-sync' as PermissionName,
                  });
                  if (status.state === 'granted') {
                    await (reg as any).periodicSync.register('check-reminders', {
                      minInterval: 60 * 60 * 1000, // 1 hour
                    });
                  }
                }
              } catch (e) {
                console.warn('Periodic sync could not be registered', e);
              }
            } else {
              new Notification(title, {
                body,
                icon: '/icon.svg'
              });
            }
            
            // Reset the timer
            localStorage.setItem('albarakah_last_notified', now.toString());
          } catch (e) {
            console.error('Notification error:', e);
            // Even on error, update time so it doesn't loop endlessly failing
            localStorage.setItem('albarakah_last_notified', now.toString());
          }
        }
      }
    };

    // Check every minute
    const interval = setInterval(checkAndNotify, 60 * 1000); 
    
    // Check on mount as well
    checkAndNotify();

    return () => clearInterval(interval);
  }, []);
}
