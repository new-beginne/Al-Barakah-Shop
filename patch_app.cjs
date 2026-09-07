const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/App.tsx');
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('WifiOff')) {
  content = content.replace("import { Menu, User, Calendar as CalendarIcon, Clock } from 'lucide-react';", "import { Menu, User, Calendar as CalendarIcon, Clock, WifiOff } from 'lucide-react';");

  const hookCode = `
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
`;

  content = content.replace("const timer = setInterval(() => setTime(new Date()), 60000);", "const timer = setInterval(() => setTime(new Date()), 60000);\n" + hookCode);

  const badgeCode = `
        {isOffline && (
          <div className="flex items-center gap-1.5 bg-red-50 text-red-700 px-3 py-1.5 rounded-full border border-red-200 text-xs font-bold uppercase tracking-wider shadow-sm mr-2 animate-pulse">
            <WifiOff size={14} />
            <span className="hidden sm:inline">Offline Mode</span>
          </div>
        )}
        {/* Date & Time */}`;

  content = content.replace("{/* Date & Time */}", badgeCode);
  
  fs.writeFileSync(file, content, 'utf8');
  console.log('Patched App.tsx for offline indicator');
} else {
  console.log('Already patched');
}
