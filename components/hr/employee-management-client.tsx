'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Eye, MoreVertical, Edit, Trash2, Power, Search, UserPlus, X } from 'lucide-react';
import { StatusBadge } from '@/components/shared/status-badge';
import { DataTable, DataTableColumn } from '@/components/shared/data-table';
import { Checkbox } from '@/components/ui/checkbox';

interface Employee {
  _id: string;
  employeeId: string;
  name: string;
  email: string;
  role: string;
  managerId?: {
    _id: string;
    name: string;
    employeeId: string;
  };
  isActive: boolean;
  createdAt?: string;
}

export default function EmployeeManagementClient() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [managers, setManagers] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState({
    employeeId: '',
    name: '',
    email: '',
    role: '',
    managerId: '',
    password: '',
    isManager: false, // New field to create as manager
  });
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  useEffect(() => {
    fetchEmployees();
    fetchManagers();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/employees');
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      } else {
        toast.error('Failed to fetch employees');
      }
    } catch (error) {
      toast.error('Error fetching employees');
    } finally {
      setLoading(false);
    }
  };

  const fetchManagers = async () => {
    try {
      const response = await fetch('/api/employees');
      if (response.ok) {
        const data = await response.json();
        // Filter for managers (you might want to add a role field or check user role)
        setManagers(data.filter((emp: Employee) => emp.role.toLowerCase().includes('manager')));
      }
    } catch (error) {
      console.error('Error fetching managers:', error);
    }
  };

  const handleCreate = () => {
    setEditingEmployee(null);
    setFormData({ employeeId: '', name: '', email: '', role: '', managerId: 'none', password: '', isManager: false });
    setCreatedPassword(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (e: React.MouseEvent, employee: Employee) => {
    e.stopPropagation();
    setEditingEmployee(employee);
    setFormData({
      employeeId: employee.employeeId,
      name: employee.name,
      email: employee.email,
      role: employee.role,
      managerId: employee.managerId?._id || 'none',
      password: '',
      isManager: false, // Not applicable for editing
    });
    setCreatedPassword(null);
    setIsDialogOpen(true);
  };

  const handleView = (e: React.MouseEvent, employeeId: string) => {
    e.stopPropagation();
    router.push(`/dashboard/hr/employees/${employeeId}`);
  };

  const handleRowClick = (employee: Employee) => {
    router.push(`/dashboard/hr/employees/${employee._id}`);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this employee?')) {
      return;
    }

    try {
      const response = await fetch(`/api/employees?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Employee deleted successfully');
        fetchEmployees();
      } else {
        toast.error('Failed to delete employee');
      }
    } catch (error) {
      toast.error('Error deleting employee');
    }
  };

  const handleToggleActive = async (e: React.MouseEvent, employee: Employee) => {
    e.stopPropagation();
    try {
      const response = await fetch('/api/employees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: employee._id,
          isActive: !employee.isActive,
        }),
      });

      if (response.ok) {
        toast.success(`Employee ${!employee.isActive ? 'activated' : 'deactivated'} successfully`);
        fetchEmployees();
      } else {
        toast.error('Failed to update employee status');
      }
    } catch (error) {
      toast.error('Error updating employee status');
    }
  };

  const isNewEmployee = (employee: Employee): boolean => {
    if (!employee.createdAt) return false;
    const createdAt = new Date(employee.createdAt);
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    return createdAt >= fiveDaysAgo;
  };

  const columns: DataTableColumn<Employee>[] = [
    {
      key: 'employeeId',
      header: 'Employee ID',
    },
    {
      key: 'name',
      header: 'Name',
      render: (employee) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{employee.name}</span>
          {isNewEmployee(employee) && (
            <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-xs">
              NEW
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
    },
    {
      key: 'role',
      header: 'Role',
    },
    {
      key: 'managerId',
      header: 'Manager',
      render: (employee) => (
        <span>{employee.managerId ? employee.managerId.name : '-'}</span>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (employee) => (
        <StatusBadge status={employee.isActive ? 'active' : 'inactive'} />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'w-[50px]',
      render: (employee) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => handleView(e, employee._id)}>
              <Eye className="h-4 w-4 mr-2" />
              View
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => handleEdit(e, employee)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => handleToggleActive(e, employee)}>
              <Power className="h-4 w-4 mr-2" />
              {employee.isActive ? 'Deactivate' : 'Activate'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => handleDelete(e, employee._id)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = '/api/employees';
      const method = editingEmployee ? 'PUT' : 'POST';
      
      // If creating as manager, ensure role includes "Manager"
      let role = formData.role;
      if (!editingEmployee && formData.isManager && !role.toLowerCase().includes('manager')) {
        role = role ? `${role} Manager` : 'Manager';
      }
      
      const body = editingEmployee
        ? { 
            id: editingEmployee._id, 
            employeeId: formData.employeeId,
            name: formData.name,
            email: formData.email,
            role: formData.role,
            managerId: formData.managerId === 'none' || !formData.managerId ? null : formData.managerId 
          }
        : { 
            employeeId: formData.employeeId,
            name: formData.name,
            email: formData.email,
            role: role,
            managerId: formData.managerId === 'none' || !formData.managerId ? null : formData.managerId,
            password: formData.password || undefined,
            isManager: formData.isManager
          };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        if (!editingEmployee && data.defaultPassword) {
          setCreatedPassword(data.defaultPassword);
          toast.success(`Employee${formData.isManager ? ' (Manager)' : ''} created successfully! Default password: ${data.defaultPassword}`, { duration: 10000 });
        } else {
          toast.success(editingEmployee ? 'Employee updated successfully' : 'Employee created successfully');
          setIsDialogOpen(false);
          fetchEmployees();
          fetchManagers(); // Refresh managers list
          setFormData({ employeeId: '', name: '', email: '', role: '', managerId: '', password: '', isManager: false });
        }
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save employee');
      }
    } catch (error) {
      toast.error('Error saving employee');
    }
  };

  // Filter employees based on search and filters
  const filteredEmployees = employees.filter((employee) => {
    const matchesSearch = 
      employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employee.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employee.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employee.role.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = 
      statusFilter === 'all' || 
      (statusFilter === 'active' && employee.isActive) ||
      (statusFilter === 'inactive' && !employee.isActive);
    
    const matchesRole = 
      roleFilter === 'all' || 
      employee.role.toLowerCase().includes(roleFilter.toLowerCase());
    
    return matchesSearch && matchesStatus && matchesRole;
  });

  // Get unique roles for filter
  const uniqueRoles = Array.from(new Set(employees.map(emp => emp.role))).sort();

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-gray-200 rounded w-48 animate-pulse"></div>
        <Card>
          <CardHeader>
            <div className="h-6 bg-gray-200 rounded w-32 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-48 animate-pulse mt-2"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded animate-pulse"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        <Button onClick={handleCreate} className="cursor-pointer">
          <UserPlus className="h-4 w-4 mr-2" />
          Create New Employee
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Employees</CardTitle>
          <CardDescription>Manage all employees in the system</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search and Filter Section */}
          <div className="mb-4 space-y-4">
            <div className="flex gap-4 flex-wrap">
              {/* Search */}
              <div className="flex-1 min-w-[250px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, ID, or role..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
                      onClick={() => setSearchQuery('')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={(value: 'all' | 'active' | 'inactive') => setStatusFilter(value)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>

              {/* Role Filter */}
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {uniqueRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Results count */}
            <div className="text-sm text-muted-foreground">
              Showing {filteredEmployees.length} of {employees.length} employees
            </div>
          </div>

          <DataTable
            data={filteredEmployees}
            columns={columns}
            onRowClick={handleRowClick}
            emptyMessage="No employees found"
          />
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-[hsl(var(--foreground))]">
              {editingEmployee ? 'Edit Employee' : 'Create New Employee'}
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-[hsl(var(--muted-foreground))]">
              {editingEmployee
                ? 'Update employee information below.'
                : 'Fill in the details to create a new employee.'}
            </DialogDescription>
          </DialogHeader>
          {createdPassword && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
              <p className="text-sm font-medium text-green-900 dark:text-green-100">
                Employee created successfully!
              </p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                Default password: <span className="font-mono font-bold">{createdPassword}</span>
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                Please share this password with the employee. They can change it after first login.
              </p>
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="employeeId">Employee ID</Label>
                  <Input
                    id="employeeId"
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    required
                    disabled={!!editingEmployee}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Input
                    id="role"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    placeholder="e.g., Software Engineer"
                    required
                  />
                </div>
              </div>
              {!editingEmployee && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password (Optional)</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Leave empty for random 7-digit password"
                      minLength={6}
                    />
                    <p className="text-xs text-muted-foreground">
                      If left empty, a random 7-digit password will be generated
                    </p>
                  </div>
                  
                  {/* Create as Manager Option */}
                  <div className="flex items-center space-x-2 p-3 border rounded-lg bg-muted/50">
                    <Checkbox
                      id="isManager"
                      checked={formData.isManager}
                      onCheckedChange={(checked) => setFormData({ ...formData, isManager: checked as boolean })}
                    />
                    <Label htmlFor="isManager" className="cursor-pointer font-medium">
                      Create as Manager
                    </Label>
                    <p className="text-xs text-muted-foreground ml-2">
                      (Will have manager role and permissions)
                    </p>
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="managerId">Manager (Optional)</Label>
                <Select
                  value={formData.managerId}
                  onValueChange={(value) => setFormData({ ...formData, managerId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a manager" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {managers.map((manager) => (
                      <SelectItem key={manager._id} value={manager._id}>
                        {manager.name} ({manager.employeeId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setIsDialogOpen(false);
                  setCreatedPassword(null);
                  setFormData({ employeeId: '', name: '', email: '', role: '', managerId: '', password: '', isManager: false });
                }}
              >
                {createdPassword ? 'Close' : 'Cancel'}
              </Button>
              {!createdPassword && (
                <Button type="submit">{editingEmployee ? 'Update' : 'Create'}</Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

