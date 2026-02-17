import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Eye, Wallet, Search, X } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";
import UniversalSearch from '../components/UniversalSearch';
import GlobalIndexingStatus from '../components/GlobalIndexingStatus';
import NotificationBell from '../components/NotificationBell';

export default function TopBar() {
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <TooltipProvider>
      <div className="bg-white border-b px-4 md:px-6 py-3 flex items-center justify-between" data-testid="topbar">
        {/* Mobile: Search Icon | Desktop: Search Bar */}
        {isMobile ? (
          <div className="flex-1">
            {searchOpen ? (
              <div className="fixed inset-0 z-50 bg-white p-4">
                <div className="flex items-center gap-2 mb-4">
                  <button 
                    onClick={() => setSearchOpen(false)}
                    className="p-2 rounded-lg hover:bg-gray-100"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <span className="font-medium">Search</span>
                </div>
                <UniversalSearch 
                  onClose={() => setSearchOpen(false)}
                  autoFocus={true}
                />
              </div>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                data-testid="mobile-search-btn"
              >
                <Search className="w-5 h-5" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 max-w-2xl">
            {searchOpen ? (
              <UniversalSearch 
                onClose={() => setSearchOpen(false)}
                autoFocus={true}
              />
            ) : (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search tokens, wallets, entities..."
                  onClick={() => setSearchOpen(true)}
                  readOnly
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                />
              </div>
            )}
          </div>
        )}

        {/* Right Section - Icons + Connect */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Global Indexing Status */}
          <GlobalIndexingStatus />

          {/* Watchlist Icon */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link 
                to="/watchlist"
                className={`p-2.5 rounded-full transition-colors ${
                  isActive('/watchlist') 
                    ? 'text-gray-900 bg-gray-100' 
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Eye className="w-5 h-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent className="bg-gray-900 text-white">
              <p className="text-xs">Watchlist</p>
            </TooltipContent>
          </Tooltip>

          {/* Alerts - NotificationBell with dropdown */}
          <NotificationBell />

          {/* Connect Wallet Button - BLACK (original) */}
          <button className="flex items-center gap-2 px-3 md:px-5 py-2 md:py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-full text-xs md:text-sm font-bold transition-all shadow-lg shadow-gray-900/20 hover:shadow-xl hover:shadow-gray-900/30 hover:scale-105 active:scale-95">
            <Wallet className="w-4 h-4" />
            <span className="hidden sm:inline">Connect</span>
          </button>
        </div>
      </div>
    </TooltipProvider>
  );
}
