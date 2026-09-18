import React, { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Bell, Check, Trash2, X } from 'lucide-react';
import { formatDateStr } from '../utils/dateFormatter';

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch unread notifications
  const notifications = useLiveQuery(
    () => db.notifications.reverse().limit(20).toArray()
  ) || [];

  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (id?: number) => {
    if (id) {
      await db.notifications.update(id, { isRead: true });
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id!);
    await Promise.all(unreadIds.map(id => db.notifications.update(id, { isRead: true })));
  };

  const clearAll = async () => {
    await db.notifications.clear();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors flex items-center justify-center"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden flex flex-col max-h-[85vh]">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              Notifications
              {unreadCount > 0 && (
                <span className="bg-[#084b3e] text-white text-[10px] px-2 py-0.5 rounded-full">
                  {unreadCount} New
                </span>
              )}
            </h3>
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <>
                  <button 
                    onClick={markAllAsRead}
                    title="Mark all as read"
                    className="p-1.5 text-gray-500 hover:text-[#084b3e] hover:bg-emerald-50 rounded-lg transition-colors"
                  >
                    <Check size={16} />
                  </button>
                  <button 
                    onClick={clearAll}
                    title="Clear all"
                    className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              )}
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-900 bg-white rounded-full shadow-sm md:hidden"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          
          <div className="overflow-y-auto flex-1 p-2">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-gray-500 flex flex-col items-center">
                <Bell size={24} className="text-gray-300 mb-2" />
                <p className="text-sm font-medium">No notifications yet</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {notifications.map((notification) => (
                  <div 
                    key={notification.id}
                    onClick={() => markAsRead(notification.id)}
                    className={`p-3 rounded-xl transition-colors cursor-pointer ${
                      notification.isRead 
                        ? 'bg-white hover:bg-gray-50' 
                        : 'bg-emerald-50/50 hover:bg-emerald-50 border border-emerald-100/50'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h4 className={`text-sm ${notification.isRead ? 'font-semibold text-gray-800' : 'font-bold text-gray-900'}`}>
                        {notification.title}
                      </h4>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2 mt-0.5">
                        {notification.time}
                      </span>
                    </div>
                    <p className={`text-xs ${notification.isRead ? 'text-gray-500' : 'text-gray-700 font-medium'}`}>
                      {notification.message}
                    </p>
                    <div className="text-[10px] text-gray-400 mt-2">
                      {notification.date}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
