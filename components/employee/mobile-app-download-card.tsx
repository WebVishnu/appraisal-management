'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Smartphone, Download, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface APKInfo {
  exists: boolean;
  version?: string;
  size?: number;
  sizeFormatted?: string;
  lastModified?: string;
  fileName?: string;
  downloadUrl?: string;
  message?: string;
}

export default function MobileAppDownloadCard() {
  const [apkInfo, setApkInfo] = useState<APKInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetchAPKInfo();
  }, []);

  const fetchAPKInfo = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/mobile-app/info');
      if (response.ok) {
        const data = await response.json();
        setApkInfo(data);
      } else {
        setApkInfo({ exists: false, message: 'Unable to fetch APK information' });
      }
    } catch (error) {
      console.error('Error fetching APK info:', error);
      setApkInfo({ exists: false, message: 'Error fetching APK information' });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const response = await fetch('/api/mobile-app/download');
      
      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || 'Failed to download APK');
        return;
      }

      // Get the blob from the response
      const blob = await response.blob();
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = apkInfo?.fileName || 'hrms-mobile-app.apk';
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('APK download started');
    } catch (error: any) {
      console.error('Error downloading APK:', error);
      toast.error('Failed to download APK. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Mobile App
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-200 dark:border-blue-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-blue-500" />
          Mobile App
        </CardTitle>
        <CardDescription>
          Download the HRMS mobile app for Android
        </CardDescription>
      </CardHeader>
      <CardContent>
        {apkInfo?.exists ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium">APK Available</span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Version:</span>
                <Badge variant="outline">{apkInfo.version || '1.0.0'}</Badge>
              </div>
              {apkInfo.sizeFormatted && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Size:</span>
                  <span className="font-medium">{apkInfo.sizeFormatted}</span>
                </div>
              )}
              {apkInfo.lastModified && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Updated:</span>
                  <span className="font-medium">
                    {new Date(apkInfo.lastModified).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            <Button
              onClick={handleDownload}
              disabled={downloading}
              className="w-full"
              size="lg"
            >
              {downloading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Download APK
                </>
              )}
            </Button>

            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                <strong>Installation Instructions:</strong>
              </p>
              <ol className="text-xs text-muted-foreground mt-1 space-y-1 list-decimal list-inside">
                <li>Download the APK file</li>
                <li>Enable "Install from Unknown Sources" in Android settings</li>
                <li>Open the downloaded APK file</li>
                <li>Follow the installation prompts</li>
              </ol>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {apkInfo?.message || 'Mobile app APK is not available at this time.'}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Please contact your administrator for access to the mobile app.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

