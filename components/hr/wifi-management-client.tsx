'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Wifi,
  Plus,
  Edit,
  Trash2,
  Shield,
  AlertCircle,
  CheckCircle,
  XCircle,
  Search,
  Filter,
} from 'lucide-react';
import { SkeletonCard } from '@/components/shared/skeleton-loader';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

interface WiFiNetwork {
  _id: string;
  ssid: string;
  bssid?: string;
  location?: string;
  officeAddress?: string;
  description?: string;
  isActive: boolean;
  priority: number;
  createdBy: {
    email: string;
  };
  createdAt: string;
}

interface WiFiPolicy {
  _id: string;
  name: string;
  description?: string;
  scope: 'company' | 'office' | 'department' | 'shift' | 'employee';
  scopeIds?: {
    officeId?: string;
    departmentId?: string;
    shiftId?: string;
    employeeId?: string;
  };
  requireWiFi: boolean;
  allowedNetworks: WiFiNetwork[];
  allowOverride: boolean;
  requireOverrideReason: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
  daysOfWeek?: number[];
  timeRange?: {
    start: string;
    end: string;
  };
  status: 'active' | 'inactive' | 'scheduled';
  isActive: boolean;
  createdBy: {
    email: string;
  };
  createdAt: string;
}

export default function WiFiManagementClient() {
  const [loading, setLoading] = useState(true);
  const [networks, setNetworks] = useState<WiFiNetwork[]>([]);
  const [policies, setPolicies] = useState<WiFiPolicy[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState<string>('all');
  
  // Network dialog state
  const [networkDialogOpen, setNetworkDialogOpen] = useState(false);
  const [editingNetwork, setEditingNetwork] = useState<WiFiNetwork | null>(null);
  const [networkFormData, setNetworkFormData] = useState({
    ssid: '',
    bssid: '',
    location: '',
    officeAddress: '',
    description: '',
    isActive: true,
    priority: 0,
  });

  // Policy dialog state
  const [policyDialogOpen, setPolicyDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<WiFiPolicy | null>(null);
  const [policyFormData, setPolicyFormData] = useState({
    name: '',
    description: '',
    scope: 'company' as const,
    scopeIds: {} as any,
    requireWiFi: true,
    allowedNetworks: [] as string[],
    allowOverride: true,
    requireOverrideReason: true,
    status: 'active' as const,
    isActive: true,
  });

  useEffect(() => {
    fetchNetworks();
    fetchPolicies();
  }, []);

  const fetchNetworks = async () => {
    try {
      const response = await fetch('/api/wifi/networks');
      if (response.ok) {
        const data = await response.json();
        setNetworks(data);
      }
    } catch (error) {
      console.error('Error fetching networks:', error);
      toast.error('Failed to fetch WiFi networks');
    } finally {
      setLoading(false);
    }
  };

  const fetchPolicies = async () => {
    try {
      const response = await fetch('/api/wifi/policies');
      if (response.ok) {
        const data = await response.json();
        setPolicies(data);
      }
    } catch (error) {
      console.error('Error fetching policies:', error);
      toast.error('Failed to fetch WiFi policies');
    }
  };

  const handleCreateNetwork = () => {
    setEditingNetwork(null);
    setNetworkFormData({
      ssid: '',
      bssid: '',
      location: '',
      officeAddress: '',
      description: '',
      isActive: true,
      priority: 0,
    });
    setNetworkDialogOpen(true);
  };

  const handleEditNetwork = (network: WiFiNetwork) => {
    setEditingNetwork(network);
    setNetworkFormData({
      ssid: network.ssid,
      bssid: network.bssid || '',
      location: network.location || '',
      officeAddress: network.officeAddress || '',
      description: network.description || '',
      isActive: network.isActive,
      priority: network.priority,
    });
    setNetworkDialogOpen(true);
  };

  const handleSaveNetwork = async () => {
    try {
      const url = '/api/wifi/networks';
      const method = editingNetwork ? 'PUT' : 'POST';
      const body = editingNetwork
        ? { id: editingNetwork._id, ...networkFormData }
        : networkFormData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        toast.success(editingNetwork ? 'Network updated' : 'Network created');
        setNetworkDialogOpen(false);
        fetchNetworks();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save network');
      }
    } catch (error) {
      toast.error('Failed to save network');
    }
  };

  const handleDeleteNetwork = async (id: string) => {
    if (!confirm('Are you sure you want to delete this network?')) return;

    try {
      const response = await fetch(`/api/wifi/networks?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Network deleted');
        fetchNetworks();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to delete network');
      }
    } catch (error) {
      toast.error('Failed to delete network');
    }
  };

  const filteredNetworks = networks.filter((network) => {
    if (filterActive === 'active' && !network.isActive) return false;
    if (filterActive === 'inactive' && network.isActive) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        network.ssid.toLowerCase().includes(search) ||
        network.location?.toLowerCase().includes(search) ||
        network.bssid?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">WiFi Attendance Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage allowed WiFi networks and attendance policies
        </p>
      </div>

      <Tabs defaultValue="networks" className="space-y-4">
        <TabsList>
          <TabsTrigger value="networks">WiFi Networks</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
        </TabsList>

        <TabsContent value="networks" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>WiFi Networks</CardTitle>
                  <CardDescription>
                    Manage approved WiFi networks for attendance validation
                  </CardDescription>
                </div>
                <Button onClick={handleCreateNetwork}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Network
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search networks..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={filterActive} onValueChange={setFilterActive}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Networks</SelectItem>
                    <SelectItem value="active">Active Only</SelectItem>
                    <SelectItem value="inactive">Inactive Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {loading ? (
                <SkeletonCard />
              ) : filteredNetworks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No networks found
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredNetworks.map((network) => (
                    <Card key={network._id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Wifi className="h-5 w-5 text-blue-600" />
                            <h3 className="font-semibold text-lg">{network.ssid}</h3>
                            <Badge variant={network.isActive ? 'default' : 'secondary'}>
                              {network.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                            {network.bssid && (
                              <Badge variant="outline" className="text-xs">
                                BSSID: {network.bssid}
                              </Badge>
                            )}
                          </div>
                          {network.location && (
                            <p className="text-sm text-muted-foreground mb-1">
                              Location: {network.location}
                            </p>
                          )}
                          {network.description && (
                            <p className="text-sm text-muted-foreground">
                              {network.description}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            Priority: {network.priority} • Created: {new Date(network.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditNetwork(network)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteNetwork(network._id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policies">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>WiFi Policies</CardTitle>
                  <CardDescription>
                    Configure attendance rules based on WiFi networks
                  </CardDescription>
                </div>
                <Button onClick={() => setPolicyDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Policy
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {policies.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No policies configured. Create one to enforce WiFi-based attendance.
                </div>
              ) : (
                <div className="space-y-4">
                  {policies.map((policy) => (
                    <Card key={policy._id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Shield className="h-5 w-5 text-green-600" />
                            <h3 className="font-semibold text-lg">{policy.name}</h3>
                            <Badge variant={policy.isActive ? 'default' : 'secondary'}>
                              {policy.status}
                            </Badge>
                            <Badge variant="outline">{policy.scope}</Badge>
                          </div>
                          {policy.description && (
                            <p className="text-sm text-muted-foreground mb-2">
                              {policy.description}
                            </p>
                          )}
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Require WiFi:</span>{' '}
                              {policy.requireWiFi ? (
                                <CheckCircle className="h-4 w-4 inline text-green-600" />
                              ) : (
                                <XCircle className="h-4 w-4 inline text-red-600" />
                              )}
                            </div>
                            <div>
                              <span className="text-muted-foreground">Allowed Networks:</span>{' '}
                              {policy.allowedNetworks.length}
                            </div>
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance">
          <Card>
            <CardHeader>
              <CardTitle>Compliance Monitoring</CardTitle>
              <CardDescription>
                View attendance attempts and WiFi validation failures
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Compliance monitoring coming soon
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Network Dialog */}
      <Dialog open={networkDialogOpen} onOpenChange={setNetworkDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingNetwork ? 'Edit WiFi Network' : 'Add WiFi Network'}
            </DialogTitle>
            <DialogDescription>
              Configure a WiFi network that will be allowed for attendance
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ssid">WiFi Name (SSID) *</Label>
                <Input
                  id="ssid"
                  value={networkFormData.ssid}
                  onChange={(e) =>
                    setNetworkFormData({ ...networkFormData, ssid: e.target.value })
                  }
                  placeholder="Office-WiFi"
                />
              </div>
              <div>
                <Label htmlFor="bssid">BSSID (MAC Address)</Label>
                <Input
                  id="bssid"
                  value={networkFormData.bssid}
                  onChange={(e) =>
                    setNetworkFormData({ ...networkFormData, bssid: e.target.value })
                  }
                  placeholder="AA:BB:CC:DD:EE:FF (optional)"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Optional: Provides higher security by validating MAC address
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={networkFormData.location}
                  onChange={(e) =>
                    setNetworkFormData({ ...networkFormData, location: e.target.value })
                  }
                  placeholder="Main Office"
                />
              </div>
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Input
                  id="priority"
                  type="number"
                  value={networkFormData.priority}
                  onChange={(e) =>
                    setNetworkFormData({
                      ...networkFormData,
                      priority: parseInt(e.target.value) || 0,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Higher priority = more specific match
                </p>
              </div>
            </div>
            <div>
              <Label htmlFor="officeAddress">Office Address</Label>
              <Input
                id="officeAddress"
                value={networkFormData.officeAddress}
                onChange={(e) =>
                  setNetworkFormData({ ...networkFormData, officeAddress: e.target.value })
                }
                placeholder="123 Main St, City, State"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={networkFormData.description}
                onChange={(e) =>
                  setNetworkFormData({ ...networkFormData, description: e.target.value })
                }
                placeholder="Additional notes about this network"
                rows={3}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isActive"
                checked={networkFormData.isActive}
                onCheckedChange={(checked) =>
                  setNetworkFormData({ ...networkFormData, isActive: checked as boolean })
                }
              />
              <Label htmlFor="isActive" className="cursor-pointer">
                Network is active
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNetworkDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveNetwork}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

