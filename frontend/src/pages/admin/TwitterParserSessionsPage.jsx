/**
 * Twitter Parser Sessions Admin Page
 * Simplified setup flow:
 * 1. Download Extension
 * 2. Generate API Key
 * 3. Configure & Sync
 * 
 * LIGHT THEME VERSION
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import {
  getSessions,
  getWebhookInfo,
  regenerateApiKey,
  testSession,
  deleteSession,
} from '../../api/twitterParserAdmin.api';
import { api } from '../../api/client';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';
import {
  ArrowLeft,
  RefreshCw,
  Trash2,
  Cookie,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Key,
  Copy,
  Download,
  PlayCircle,
  Bell,
  ShieldCheck,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  OK: { label: 'Valid', icon: CheckCircle, color: 'bg-green-50 text-green-700 border-green-200' },
  STALE: { label: 'Stale', icon: Clock, color: 'bg-amber-50 text-amber-700 border-amber-200' },
  INVALID: { label: 'Invalid', icon: XCircle, color: 'bg-red-50 text-red-700 border-red-200' },
  EXPIRED: { label: 'Expired', icon: XCircle, color: 'bg-red-50 text-red-700 border-red-200' },
};

function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.INVALID;
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`${config.color} font-medium`}>
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  );
}

export default function TwitterParserSessionsPage() {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAdminAuth();

  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState({ total: 0, ok: 0, stale: 0, invalid: 0 });
  const [webhookInfo, setWebhookInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [regenerating, setRegenerating] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [testingSession, setTestingSession] = useState(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getSessions();
      if (res.ok) {
        setSessions(res.data || []);
        setStats(res.stats || { total: 0, ok: 0, stale: 0, invalid: 0 });
      } else {
        setError(res.error || 'Failed to load sessions');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWebhookInfo = useCallback(async () => {
    try {
      const res = await getWebhookInfo();
      if (res.ok) {
        setWebhookInfo(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch webhook info:', err);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchSessions();
      fetchWebhookInfo();
    }
  }, [authLoading, isAuthenticated, fetchSessions, fetchWebhookInfo]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/admin/login');
    }
  }, [authLoading, isAuthenticated, navigate]);

  const handleTest = async (session) => {
    setTestingSession(session.sessionId);
    try {
      const res = await testSession(session.sessionId);
      if (res.ok) {
        if (res.valid) {
          toast.success(`Session ${session.sessionId} is valid (${res.cookieCount} cookies)`);
        } else {
          toast.error(`Session invalid: ${res.reason}`);
        }
        fetchSessions();
      } else {
        toast.error(res.error || 'Test failed');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setTestingSession(null);
    }
  };

  const handleDelete = async (sessionId) => {
    const res = await deleteSession(sessionId);
    if (res.ok) {
      toast.success('Session deleted');
      setConfirmDelete(null);
      fetchSessions();
    } else {
      toast.error(res.error || 'Failed to delete');
    }
  };

  const handleRegenerateKey = async () => {
    setRegenerating(true);
    try {
      const res = await regenerateApiKey();
      if (res.ok) {
        setWebhookInfo(prev => ({ ...prev, apiKey: res.data.apiKey }));
        toast.success('New API Key generated! Update your extension.');
      } else {
        toast.error(res.error || 'Failed to generate key');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRegenerating(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      const res = await api.post('/api/admin/twitter-parser/sessions/test-notification');
      if (res.data.ok) {
        toast.success('Test notification sent to Telegram!');
      } else {
        toast.error(res.data.error || 'Failed to send notification');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const platformUrl = webhookInfo?.platformUrl || window.location.origin;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" data-testid="admin-sessions-page">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/admin/system-overview" className="p-2 hover:bg-gray-100 rounded-lg transition">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Twitter Parser Admin</h1>
              <p className="text-sm text-gray-500">Configure cookie sessions for parsing</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleTestNotification} title="Test Telegram notification">
              <Bell className="w-4 h-4 mr-2" />
              Test Alert
            </Button>
            <Button variant="outline" onClick={fetchSessions} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex gap-6">
            <Link to="/admin/twitter-parser/accounts" className="py-3 border-b-2 border-transparent text-gray-500 hover:text-gray-700 text-sm font-medium">
              Accounts
            </Link>
            <Link to="/admin/twitter-parser/sessions" className="py-3 border-b-2 border-teal-500 text-teal-600 text-sm font-medium">
              Sessions
            </Link>
            <Link to="/admin/twitter-parser/slots" className="py-3 border-b-2 border-transparent text-gray-500 hover:text-gray-700 text-sm font-medium">
              Egress Slots
            </Link>
            {/* Proxy Servers tab hidden */}
            <Link to="/admin/twitter-parser/monitor" className="py-3 border-b-2 border-transparent text-gray-500 hover:text-gray-700 text-sm font-medium">
              Monitor
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {/* Setup Card - Always visible */}
        <Card className="border-gray-200 mb-6">
          <CardHeader>
            <CardTitle className="text-gray-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-teal-500" />
              Extension Setup
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Step 1: Download Extension */}
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-teal-600">1</span>
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 mb-2">Download Extension</h4>
                  <p className="text-sm text-gray-600 mb-3">Download and install the Chrome extension to sync Twitter cookies.</p>
                  <a
                    href="/fomo_extension_v1.3.0.zip"
                    download
                    className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition"
                    data-testid="download-extension-btn"
                  >
                    <Download className="w-4 h-4" />
                    Download Extension (ZIP)
                  </a>
                  <p className="text-xs text-gray-500 mt-2">
                    Install: chrome://extensions → Developer mode → Load unpacked
                  </p>
                </div>
              </div>

              {/* Step 2: Generate API Key */}
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-teal-600">2</span>
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 mb-2">Your API Key</h4>
                  <p className="text-sm text-gray-600 mb-3">Use this key in the extension settings.</p>
                  <div className="flex items-center gap-2 mb-3">
                    <code className="flex-1 p-3 bg-gray-100 rounded-lg text-sm font-mono break-all border border-gray-200">
                      {webhookInfo?.apiKey || 'Loading...'}
                    </code>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => copyToClipboard(webhookInfo?.apiKey)}
                      disabled={!webhookInfo?.apiKey}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleRegenerateKey}
                    disabled={regenerating}
                    className="text-teal-600"
                  >
                    {regenerating ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Key className="w-4 h-4 mr-2" />
                    )}
                    Generate New Key
                  </Button>
                </div>
              </div>

              {/* Step 3: Platform URL */}
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-teal-600">3</span>
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 mb-2">Platform URL</h4>
                  <p className="text-sm text-gray-600 mb-3">Enter this URL in the extension.</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-3 bg-gray-100 rounded-lg text-sm font-mono break-all border border-gray-200 text-teal-600">
                      {platformUrl}
                    </code>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => copyToClipboard(platformUrl)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Step 4: Sync */}
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-teal-600">4</span>
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 mb-2">Sync Session</h4>
                  <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                    <li>Log in to Twitter/X in your browser</li>
                    <li>Click the extension icon</li>
                    <li>Click <strong>"Sync Session"</strong></li>
                    <li>Session will appear below ↓</li>
                  </ol>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card className="border-gray-200">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-xs text-gray-500">Total Sessions</div>
            </CardContent>
          </Card>
          <Card className="border-gray-200">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-600">{stats.ok}</div>
              <div className="text-xs text-gray-500">Valid</div>
            </CardContent>
          </Card>
          <Card className="border-gray-200">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-amber-600">{stats.stale}</div>
              <div className="text-xs text-gray-500">Stale</div>
            </CardContent>
          </Card>
          <Card className="border-gray-200">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-red-600">{stats.invalid}</div>
              <div className="text-xs text-gray-500">Invalid</div>
            </CardContent>
          </Card>
        </div>

        {/* Sessions List */}
        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900">Active Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-teal-500 mx-auto" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Cookie className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No sessions yet</p>
                <p className="text-sm mt-2">Complete the setup above to sync your first session</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => (
                  <div key={session._id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center">
                        <Cookie className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{session.sessionId}</div>
                        {session.accountId && (
                          <div className="text-sm text-gray-600">
                            Account: @{session.accountId.username || session.accountId}
                          </div>
                        )}
                        <div className="text-xs text-gray-400">
                          {session.cookiesMeta?.count || 0} cookies • 
                          {session.cookiesMeta?.hasAuthToken ? ' ✓ auth_token' : ' ✗ auth_token'}
                          {session.cookiesMeta?.hasCt0 ? ' • ✓ ct0' : ' • ✗ ct0'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={session.status} />
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleTest(session)}
                          disabled={testingSession === session.sessionId}
                          title="Test session"
                        >
                          {testingSession === session.sessionId ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <PlayCircle className="w-4 h-4" />
                          )}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-500 hover:text-red-700" 
                          onClick={() => setConfirmDelete(session)}
                          title="Delete session"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className="bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Delete Session?</DialogTitle>
          </DialogHeader>
          <p className="text-gray-600">
            Are you sure you want to delete session <strong>{confirmDelete?.sessionId}</strong>? 
            This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button 
              className="bg-red-500 hover:bg-red-600 text-white" 
              onClick={() => handleDelete(confirmDelete?.sessionId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
