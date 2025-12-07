'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Trash2, Calendar, FileText, Star, Lock } from 'lucide-react';

interface Competency {
  name: string;
  type: 'rating' | 'text';
  maxRating?: number;
}

interface Cycle {
  _id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'draft' | 'open_self_review' | 'open_manager_review' | 'closed';
  competencies: Competency[];
  createdBy: {
    email: string;
  };
}

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  open_self_review: 'Open for Self Review',
  open_manager_review: 'Open for Manager Review',
  closed: 'Closed',
};

const statusFlow: Record<string, string[]> = {
  draft: ['open_self_review'],
  open_self_review: ['open_manager_review'],
  open_manager_review: ['closed'],
  closed: [],
};

export default function CycleManagementClient() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCycle, setEditingCycle] = useState<Cycle | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    startDate: '',
    endDate: '',
    competencies: [] as Competency[],
  });

  useEffect(() => {
    fetchCycles();
  }, []);

  const fetchCycles = async () => {
    try {
      const response = await fetch('/api/cycles');
      if (response.ok) {
        const data = await response.json();
        setCycles(data);
      } else {
        toast.error('Failed to fetch cycles');
      }
    } catch (error) {
      toast.error('Error fetching cycles');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingCycle(null);
    setFormData({
      name: '',
      startDate: '',
      endDate: '',
      competencies: [{ name: '', type: 'rating', maxRating: 5 }],
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (cycle: Cycle) => {
    setEditingCycle(cycle);
    setFormData({
      name: cycle.name,
      startDate: new Date(cycle.startDate).toISOString().split('T')[0],
      endDate: new Date(cycle.endDate).toISOString().split('T')[0],
      competencies: cycle.competencies.length > 0 ? cycle.competencies : [{ name: '', type: 'rating', maxRating: 5 }],
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this cycle?')) {
      return;
    }

    try {
      const response = await fetch(`/api/cycles?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Cycle deleted successfully');
        fetchCycles();
      } else {
        toast.error('Failed to delete cycle');
      }
    } catch (error) {
      toast.error('Error deleting cycle');
    }
  };

  const handleStatusUpdate = async (cycle: Cycle, newStatus: string) => {
    try {
      const response = await fetch('/api/cycles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: cycle._id,
          status: newStatus,
        }),
      });

      if (response.ok) {
        toast.success('Cycle status updated successfully');
        fetchCycles();
      } else {
        toast.error('Failed to update cycle status');
      }
    } catch (error) {
      toast.error('Error updating cycle status');
    }
  };

  const handleCloseCycle = async (cycle: Cycle) => {
    if (!confirm(`Are you sure you want to close the cycle "${cycle.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch('/api/cycles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: cycle._id,
          status: 'closed',
        }),
      });

      if (response.ok) {
        toast.success('Cycle closed successfully');
        fetchCycles();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to close cycle');
      }
    } catch (error) {
      toast.error('Error closing cycle');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.competencies.length === 0) {
      toast.error('Please add at least one competency');
      return;
    }

    if (formData.competencies.some((c) => !c.name)) {
      toast.error('Please fill in all competency names');
      return;
    }

    try {
      const url = '/api/cycles';
      const method = editingCycle ? 'PUT' : 'POST';
      const body = editingCycle
        ? { id: editingCycle._id, ...formData }
        : formData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        toast.success(editingCycle ? 'Cycle updated successfully' : 'Cycle created successfully');
        setIsDialogOpen(false);
        fetchCycles();
        setFormData({
          name: '',
          startDate: '',
          endDate: '',
          competencies: [{ name: '', type: 'rating', maxRating: 5 }],
        });
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save cycle');
      }
    } catch (error) {
      toast.error('Error saving cycle');
    }
  };

  const addCompetency = () => {
    setFormData({
      ...formData,
      competencies: [...formData.competencies, { name: '', type: 'rating', maxRating: 5 }],
    });
  };

  const removeCompetency = (index: number) => {
    setFormData({
      ...formData,
      competencies: formData.competencies.filter((_, i) => i !== index),
    });
  };

  const updateCompetency = (index: number, field: keyof Competency, value: any) => {
    const updated = [...formData.competencies];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, competencies: updated });
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        <Button onClick={handleCreate}>Create New Cycle</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Appraisal Cycles</CardTitle>
          <CardDescription>Manage all appraisal cycles</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Competencies</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cycles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    No cycles found
                  </TableCell>
                </TableRow>
              ) : (
                cycles.map((cycle) => {
                  const nextStatuses = statusFlow[cycle.status] || [];
                  return (
                    <TableRow key={cycle._id}>
                      <TableCell className="font-medium">{cycle.name}</TableCell>
                      <TableCell>{new Date(cycle.startDate).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(cycle.endDate).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                          {statusLabels[cycle.status]}
                        </span>
                      </TableCell>
                      <TableCell>{cycle.competencies.length}</TableCell>
                      <TableCell>
                        <div className="flex gap-2 flex-wrap">
                          {cycle.status !== 'closed' && cycle.status !== 'draft' && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleCloseCycle(cycle)}
                              className="bg-red-600 hover:bg-red-700 text-white"
                            >
                              <Lock className="h-4 w-4 mr-1" />
                              Close Cycle
                            </Button>
                          )}
                          {nextStatuses.length > 0 && (
                            <Select
                              value=""
                              onValueChange={(value) => handleStatusUpdate(cycle, value)}
                            >
                              <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Update Status" />
                              </SelectTrigger>
                              <SelectContent>
                                {nextStatuses.map((status) => (
                                  <SelectItem key={status} value={status}>
                                    Move to {statusLabels[status]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          <Button variant="outline" size="sm" onClick={() => handleEdit(cycle)}>
                            Edit
                          </Button>
                          {cycle.status === 'draft' && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(cycle._id)}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-2xl font-semibold">
              {editingCycle ? 'Edit Cycle' : 'Create New Cycle'}
            </DialogTitle>
            <DialogDescription className="text-base mt-2">
              {editingCycle
                ? 'Update the appraisal cycle information below.'
                : 'Fill in the details to create a new appraisal cycle for your organization.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-6 py-6">
              {/* Basic Information Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold">Basic Information</h3>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium">
                      Cycle Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., H1 2025, Q1 2025, Annual 2025"
                      className="h-11"
                      required
                    />
                    <p className="text-xs text-gray-500">Enter a descriptive name for this appraisal cycle</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate" className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Start Date <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="h-11"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate" className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      End Date <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="h-11"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Competencies Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b">
                  <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-blue-600" />
                    <h3 className="text-lg font-semibold">Competencies</h3>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                      {formData.competencies.length} {formData.competencies.length === 1 ? 'competency' : 'competencies'}
                    </span>
                  </div>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={addCompetency}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Competency
                  </Button>
                </div>
                <div className="space-y-3">
                  {formData.competencies.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed rounded-lg bg-gray-50">
                      <Star className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                      <p className="text-sm text-gray-500">No competencies added yet</p>
                      <p className="text-xs text-gray-400 mt-1">Click "Add Competency" to get started</p>
                    </div>
                  ) : (
                    formData.competencies.map((comp, index) => (
                      <div 
                        key={index} 
                        className="p-4 border rounded-lg bg-white hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex gap-3 items-start">
                          <div className="flex-1 space-y-3">
                            <div className="space-y-2">
                              <Label className="text-xs text-gray-500">
                                Competency Name <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                placeholder="e.g., Communication, Technical Skills, Teamwork"
                                value={comp.name}
                                onChange={(e) => updateCompetency(index, 'name', e.target.value)}
                                className="h-10"
                                required
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label className="text-xs text-gray-500">Type</Label>
                                <Select
                                  value={comp.type}
                                  onValueChange={(value: 'rating' | 'text') =>
                                    updateCompetency(index, 'type', value)
                                  }
                                >
                                  <SelectTrigger className="h-10">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="rating">
                                      <div className="flex items-center gap-2">
                                        <Star className="h-4 w-4" />
                                        Rating
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="text">
                                      <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4" />
                                        Text
                                      </div>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              {comp.type === 'rating' && (
                                <div className="space-y-2">
                                  <Label className="text-xs text-gray-500">Max Rating</Label>
                                  <Input
                                    type="number"
                                    placeholder="Max"
                                    value={comp.maxRating || 5}
                                    onChange={(e) =>
                                      updateCompetency(index, 'maxRating', parseInt(e.target.value) || 5)
                                    }
                                    className="h-10"
                                    min="1"
                                    max="10"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCompetency(index)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 mt-6"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {formData.competencies.length > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    <span className="text-red-500">*</span> Required fields must be filled before creating the cycle
                  </p>
                )}
              </div>
            </div>
            <DialogFooter className="border-t pt-4 gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsDialogOpen(false)}
                className="min-w-[100px]"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="min-w-[100px] bg-blue-600 hover:bg-blue-700"
              >
                {editingCycle ? 'Update Cycle' : 'Create Cycle'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

