'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { toast } from 'sonner';
import {
  Plus,
  Edit,
  Trash2,
  Coffee,
  Clock,
  BarChart3,
  AlertCircle,
} from 'lucide-react';
import { SkeletonCard } from '@/components/shared/skeleton-loader';

interface BreakPolicy {
  _id: string;
  name: string;
  description?: string;
  scope: 'global' | 'department' | 'role' | 'shift' | 'employee';
  scopeIds: string[];
  allowBreaks: boolean;
  maxBreaksPerDay?: number;
  maxTotalBreakDuration?: number;
  maxDurationPerBreak?: number;
  allowedBreakTypes: string[];
  mandatoryBreaks: string[];
  minWorkingHoursBeforeFirstBreak?: number;
  gracePeriod?: number;
  paidBreaks: string[];
  deductBreakTime: boolean;
  autoFlagExcessiveBreaks: boolean;
  allowBreakOverrun: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  isActive: boolean;
  createdBy?: {
    email: string;
  };
}

interface Shift {
  _id: string;
  name: string;
}

interface BreakPoliciesTabProps {
  shifts?: Shift[];
}

export default function BreakPoliciesTab({ shifts = [] }: BreakPoliciesTabProps) {
  const [breakPolicies, setBreakPolicies] = useState<BreakPolicy[]>([]);
  const [breakAnalytics, setBreakAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [breakPolicyDialogOpen, setBreakPolicyDialogOpen] = useState(false);
  const [editingBreakPolicy, setEditingBreakPolicy] = useState<BreakPolicy | null>(null);
  const [breakPolicyFormData, setBreakPolicyFormData] = useState<{
    name: string;
    description: string;
    scope: 'global' | 'department' | 'role' | 'shift' | 'employee';
    scopeIds: string[];
    allowBreaks: boolean;
    maxBreaksPerDay?: number;
    maxTotalBreakDuration?: number;
    maxDurationPerBreak?: number;
    allowedBreakTypes: string[];
    mandatoryBreaks: string[];
    minWorkingHoursBeforeFirstBreak?: number;
    gracePeriod?: number;
    paidBreaks: string[];
    deductBreakTime: boolean;
    autoFlagExcessiveBreaks: boolean;
    allowBreakOverrun: boolean;
    effectiveFrom: string;
    effectiveTo?: string;
    isActive: boolean;
  }>({
    name: '',
    description: '',
    scope: 'global',
    scopeIds: [],
    allowBreaks: true,
    maxBreaksPerDay: 3,
    maxTotalBreakDuration: 60,
    maxDurationPerBreak: 30,
    allowedBreakTypes: ['lunch', 'tea', 'personal'],
    mandatoryBreaks: [],
    minWorkingHoursBeforeFirstBreak: 2,
    gracePeriod: 5,
    paidBreaks: ['lunch'],
    deductBreakTime: true,
    autoFlagExcessiveBreaks: true,
    allowBreakOverrun: false,
    effectiveFrom: new Date().toISOString().split('T')[0],
    effectiveTo: '',
    isActive: true,
  });

  useEffect(() => {
    fetchBreakPolicies();
    fetchBreakAnalytics();
  }, []);

  const fetchBreakPolicies = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/breaks/policies?isActive=true');
      if (response.ok) {
        const data = await response.json();
        setBreakPolicies(data);
      }
    } catch (error) {
      toast.error('Failed to fetch break policies');
    } finally {
      setLoading(false);
    }
  };

  const fetchBreakAnalytics = async () => {
    try {
      const today = new Date();
      const startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const response = await fetch(
        `/api/breaks/analytics?startDate=${startDate.toISOString().split('T')[0]}&endDate=${today.toISOString().split('T')[0]}`
      );
      if (response.ok) {
        const data = await response.json();
        setBreakAnalytics(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch break analytics:', error);
    }
  };

  const handleCreateBreakPolicy = async () => {
    try {
      const response = await fetch('/api/breaks/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(breakPolicyFormData),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Break policy created successfully');
        setBreakPolicyDialogOpen(false);
        resetBreakPolicyForm();
        fetchBreakPolicies();
      } else {
        toast.error(data.error || 'Failed to create break policy');
      }
    } catch (error) {
      toast.error('Failed to create break policy');
    }
  };

  const handleUpdateBreakPolicy = async () => {
    if (!editingBreakPolicy) return;

    try {
      const response = await fetch(`/api/breaks/policies/${editingBreakPolicy._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(breakPolicyFormData),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Break policy updated successfully');
        setBreakPolicyDialogOpen(false);
        setEditingBreakPolicy(null);
        resetBreakPolicyForm();
        fetchBreakPolicies();
      } else {
        toast.error(data.error || 'Failed to update break policy');
      }
    } catch (error) {
      toast.error('Failed to update break policy');
    }
  };

  const handleDeleteBreakPolicy = async (policyId: string) => {
    if (!confirm('Are you sure you want to deactivate this break policy?')) return;

    try {
      const response = await fetch(`/api/breaks/policies/${policyId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Break policy deactivated successfully');
        fetchBreakPolicies();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to deactivate break policy');
      }
    } catch (error) {
      toast.error('Failed to deactivate break policy');
    }
  };

  const resetBreakPolicyForm = () => {
    setBreakPolicyFormData({
      name: '',
      description: '',
      scope: 'global',
      scopeIds: [],
      allowBreaks: true,
      maxBreaksPerDay: 3,
      maxTotalBreakDuration: 60,
      maxDurationPerBreak: 30,
      allowedBreakTypes: ['lunch', 'tea', 'personal'],
      mandatoryBreaks: [],
      minWorkingHoursBeforeFirstBreak: 2,
      gracePeriod: 5,
      paidBreaks: ['lunch'],
      deductBreakTime: true,
      autoFlagExcessiveBreaks: true,
      allowBreakOverrun: false,
      effectiveFrom: new Date().toISOString().split('T')[0],
      effectiveTo: '' as string,
      isActive: true,
    });
    setEditingBreakPolicy(null);
  };

  const openEditBreakPolicy = (policy: BreakPolicy) => {
    setEditingBreakPolicy(policy);
    setBreakPolicyFormData({
      name: policy.name,
      description: policy.description || '',
      scope: policy.scope,
      scopeIds: policy.scopeIds.map((id: any) => id.toString()),
      allowBreaks: policy.allowBreaks,
      maxBreaksPerDay: policy.maxBreaksPerDay ?? 3,
      maxTotalBreakDuration: policy.maxTotalBreakDuration ?? 60,
      maxDurationPerBreak: policy.maxDurationPerBreak ?? 30,
      allowedBreakTypes: policy.allowedBreakTypes || ['lunch', 'tea', 'personal'],
      mandatoryBreaks: policy.mandatoryBreaks || [],
      minWorkingHoursBeforeFirstBreak: policy.minWorkingHoursBeforeFirstBreak ?? 2,
      gracePeriod: policy.gracePeriod ?? 5,
      paidBreaks: policy.paidBreaks || ['lunch'],
      deductBreakTime: policy.deductBreakTime ?? true,
      autoFlagExcessiveBreaks: policy.autoFlagExcessiveBreaks ?? true,
      allowBreakOverrun: policy.allowBreakOverrun ?? false,
      effectiveFrom: new Date(policy.effectiveFrom).toISOString().split('T')[0],
      effectiveTo: policy.effectiveTo ? new Date(policy.effectiveTo).toISOString().split('T')[0] : '',
      isActive: policy.isActive,
    });
    setBreakPolicyDialogOpen(true);
  };

  if (loading) {
    return <SkeletonCard />;
  }

  return (
    <div className="space-y-4">
      {/* Analytics Summary */}
      {breakAnalytics && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Breaks</p>
                  <p className="text-2xl font-bold">{breakAnalytics.summary?.totalBreaks || 0}</p>
                </div>
                <Coffee className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Break Time</p>
                  <p className="text-2xl font-bold">{breakAnalytics.summary?.totalBreakTime || 0} min</p>
                </div>
                <Clock className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Duration</p>
                  <p className="text-2xl font-bold">{breakAnalytics.summary?.avgBreakDuration || 0} min</p>
                </div>
                <BarChart3 className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Violations</p>
                  <p className="text-2xl font-bold">{breakAnalytics.summary?.violations || 0}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Policies List */}
      <div className="flex justify-end">
        <Button onClick={() => {
          resetBreakPolicyForm();
          setEditingBreakPolicy(null);
          setBreakPolicyDialogOpen(true);
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Create Break Policy
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {breakPolicies.map((policy) => (
          <Card key={policy._id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{policy.name}</CardTitle>
                  <CardDescription className="capitalize">{policy.scope} scope</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditBreakPolicy(policy)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteBreakPolicy(policy._id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Max Breaks:</span>{' '}
                  <span className="font-medium">{policy.maxBreaksPerDay || 'Unlimited'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Max Duration:</span>{' '}
                  <span className="font-medium">{policy.maxTotalBreakDuration || 'Unlimited'} min</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Allowed Types:</span>{' '}
                  <span className="font-medium">{policy.allowedBreakTypes.join(', ')}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Paid Breaks:</span>{' '}
                  <span className="font-medium">{policy.paidBreaks.join(', ') || 'None'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {breakPolicies.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No break policies found. Create one to get started.
          </CardContent>
        </Card>
      )}

      {/* Break Policy Dialog */}
      <Dialog open={breakPolicyDialogOpen} onOpenChange={setBreakPolicyDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBreakPolicy ? 'Edit Break Policy' : 'Create Break Policy'}</DialogTitle>
            <DialogDescription>Configure break rules and limits for employees</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="policyName">Policy Name *</Label>
              <Input
                id="policyName"
                value={breakPolicyFormData.name}
                onChange={(e) => setBreakPolicyFormData({ ...breakPolicyFormData, name: e.target.value })}
                placeholder="e.g., Standard Office Policy"
              />
            </div>

            <div>
              <Label htmlFor="policyDescription">Description</Label>
              <Textarea
                id="policyDescription"
                value={breakPolicyFormData.description}
                onChange={(e) => setBreakPolicyFormData({ ...breakPolicyFormData, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="policyScope">Scope *</Label>
                <Select
                  value={breakPolicyFormData.scope}
                  onValueChange={(value: any) => setBreakPolicyFormData({ ...breakPolicyFormData, scope: value, scopeIds: [] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global</SelectItem>
                    <SelectItem value="department">Department</SelectItem>
                    <SelectItem value="role">Role</SelectItem>
                    <SelectItem value="shift">Shift</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="allowBreaks">Allow Breaks</Label>
                <Select
                  value={breakPolicyFormData.allowBreaks ? 'yes' : 'no'}
                  onValueChange={(value) => setBreakPolicyFormData({ ...breakPolicyFormData, allowBreaks: value === 'yes' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {breakPolicyFormData.scope === 'shift' && shifts.length > 0 && (
              <div>
                <Label>Select Shifts</Label>
                <div className="border rounded-lg p-4 max-h-40 overflow-y-auto mt-2">
                  {shifts.map((shift) => (
                    <label key={shift._id} className="flex items-center space-x-2 py-1">
                      <input
                        type="checkbox"
                        checked={breakPolicyFormData.scopeIds.includes(shift._id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setBreakPolicyFormData({
                              ...breakPolicyFormData,
                              scopeIds: [...breakPolicyFormData.scopeIds, shift._id],
                            });
                          } else {
                            setBreakPolicyFormData({
                              ...breakPolicyFormData,
                              scopeIds: breakPolicyFormData.scopeIds.filter((id) => id !== shift._id),
                            });
                          }
                        }}
                      />
                      <span className="text-sm">{shift.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="maxBreaksPerDay">Max Breaks/Day</Label>
                <Input
                  id="maxBreaksPerDay"
                  type="number"
                  value={breakPolicyFormData.maxBreaksPerDay ?? ''}
                  onChange={(e) => setBreakPolicyFormData({ ...breakPolicyFormData, maxBreaksPerDay: e.target.value ? parseInt(e.target.value) : undefined })}
                />
              </div>
              <div>
                <Label htmlFor="maxTotalDuration">Max Total Duration (min)</Label>
                <Input
                  id="maxTotalDuration"
                  type="number"
                  value={breakPolicyFormData.maxTotalBreakDuration ?? ''}
                  onChange={(e) => setBreakPolicyFormData({ ...breakPolicyFormData, maxTotalBreakDuration: e.target.value ? parseInt(e.target.value) : undefined })}
                />
              </div>
              <div>
                <Label htmlFor="maxPerBreak">Max Per Break (min)</Label>
                <Input
                  id="maxPerBreak"
                  type="number"
                  value={breakPolicyFormData.maxDurationPerBreak ?? ''}
                  onChange={(e) => setBreakPolicyFormData({ ...breakPolicyFormData, maxDurationPerBreak: e.target.value ? parseInt(e.target.value) : undefined })}
                />
              </div>
            </div>

            <div>
              <Label>Allowed Break Types</Label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {['lunch', 'tea', 'personal', 'custom'].map((type) => (
                  <label key={type} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={breakPolicyFormData.allowedBreakTypes.includes(type)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setBreakPolicyFormData({
                            ...breakPolicyFormData,
                            allowedBreakTypes: [...breakPolicyFormData.allowedBreakTypes, type],
                          });
                        } else {
                          setBreakPolicyFormData({
                            ...breakPolicyFormData,
                            allowedBreakTypes: breakPolicyFormData.allowedBreakTypes.filter((t) => t !== type),
                            mandatoryBreaks: breakPolicyFormData.mandatoryBreaks.filter((t) => t !== type),
                            paidBreaks: breakPolicyFormData.paidBreaks.filter((t) => t !== type),
                          });
                        }
                      }}
                    />
                    <span className="text-sm capitalize">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label>Mandatory Breaks</Label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {breakPolicyFormData.allowedBreakTypes.map((type) => (
                  <label key={type} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={breakPolicyFormData.mandatoryBreaks.includes(type)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setBreakPolicyFormData({
                            ...breakPolicyFormData,
                            mandatoryBreaks: [...breakPolicyFormData.mandatoryBreaks, type],
                          });
                        } else {
                          setBreakPolicyFormData({
                            ...breakPolicyFormData,
                            mandatoryBreaks: breakPolicyFormData.mandatoryBreaks.filter((t) => t !== type),
                          });
                        }
                      }}
                    />
                    <span className="text-sm capitalize">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label>Paid Breaks</Label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {breakPolicyFormData.allowedBreakTypes.map((type) => (
                  <label key={type} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={breakPolicyFormData.paidBreaks.includes(type)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setBreakPolicyFormData({
                            ...breakPolicyFormData,
                            paidBreaks: [...breakPolicyFormData.paidBreaks, type],
                          });
                        } else {
                          setBreakPolicyFormData({
                            ...breakPolicyFormData,
                            paidBreaks: breakPolicyFormData.paidBreaks.filter((t) => t !== type),
                          });
                        }
                      }}
                    />
                    <span className="text-sm capitalize">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="minWorkingHours">Min Working Hours Before First Break</Label>
                <Input
                  id="minWorkingHours"
                  type="number"
                  value={breakPolicyFormData.minWorkingHoursBeforeFirstBreak ?? ''}
                  onChange={(e) => setBreakPolicyFormData({ ...breakPolicyFormData, minWorkingHoursBeforeFirstBreak: e.target.value ? parseInt(e.target.value) : undefined })}
                />
              </div>
              <div>
                <Label htmlFor="gracePeriod">Grace Period (min)</Label>
                <Input
                  id="gracePeriod"
                  type="number"
                  value={breakPolicyFormData.gracePeriod ?? ''}
                  onChange={(e) => setBreakPolicyFormData({ ...breakPolicyFormData, gracePeriod: e.target.value ? parseInt(e.target.value) : 5 })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="effectiveFrom">Effective From *</Label>
                <Input
                  id="effectiveFrom"
                  type="date"
                  value={breakPolicyFormData.effectiveFrom || ''}
                  onChange={(e) => setBreakPolicyFormData({ ...breakPolicyFormData, effectiveFrom: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="effectiveTo">Effective To (optional)</Label>
                <Input
                  id="effectiveTo"
                  type="date"
                  value={breakPolicyFormData.effectiveTo || ''}
                  onChange={(e) => setBreakPolicyFormData({ ...breakPolicyFormData, effectiveTo: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={breakPolicyFormData.deductBreakTime}
                  onChange={(e) => setBreakPolicyFormData({ ...breakPolicyFormData, deductBreakTime: e.target.checked })}
                />
                <span className="text-sm">Deduct break time from working hours</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={breakPolicyFormData.autoFlagExcessiveBreaks}
                  onChange={(e) => setBreakPolicyFormData({ ...breakPolicyFormData, autoFlagExcessiveBreaks: e.target.checked })}
                />
                <span className="text-sm">Auto-flag excessive breaks</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={breakPolicyFormData.allowBreakOverrun}
                  onChange={(e) => setBreakPolicyFormData({ ...breakPolicyFormData, allowBreakOverrun: e.target.checked })}
                />
                <span className="text-sm">Allow break overrun</span>
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setBreakPolicyDialogOpen(false);
              setEditingBreakPolicy(null);
              resetBreakPolicyForm();
            }}>
              Cancel
            </Button>
            <Button onClick={editingBreakPolicy ? handleUpdateBreakPolicy : handleCreateBreakPolicy}>
              {editingBreakPolicy ? 'Update' : 'Create'} Policy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

