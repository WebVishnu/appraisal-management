'use client';

import * as React from 'react';
import { Check, ChevronDown, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface CreatableSelectProps {
  options: Array<{ value: string; label: string }>;
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  createLabel?: string;
  inputLabel?: string;
  inputPlaceholder?: string;
  onCreate?: (value: string, additionalData?: any) => Promise<string | void> | string | void;
  disabled?: boolean;
  className?: string;
}

export function CreatableSelect({
  options,
  value,
  onValueChange,
  placeholder = 'Select or create...',
  createLabel = 'Create new',
  inputLabel,
  inputPlaceholder,
  onCreate,
  disabled,
  className,
}: CreatableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [newValue, setNewValue] = React.useState('');
  const [isCreating, setIsCreating] = React.useState(false);

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchValue.toLowerCase())
  );

  const showCreateOption = searchValue && 
    !filteredOptions.some(opt => opt.label.toLowerCase() === searchValue.toLowerCase());

  const handleCreate = async () => {
    if (!newValue.trim()) return;
    
    setIsCreating(true);
    try {
      let newId = newValue.trim();
      
      if (onCreate) {
        const result = await onCreate(newValue.trim());
        if (result) {
          newId = typeof result === 'string' ? result : newValue.trim();
        }
      }
      
      // Wait a moment for parent to update options, then set the value
      // Use setTimeout to ensure React has processed the state update
      // Check if the newId exists in options, if not wait a bit more
      const existsInOptions = options.some(opt => opt.value === newId);
      if (!existsInOptions) {
        // Wait a bit longer for options to update
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      onValueChange(newId);
      
      setNewValue('');
      setIsCreateDialogOpen(false);
      setOpen(false);
      setSearchValue('');
    } catch (error) {
      console.error('Error creating:', error);
      // Don't close dialog on error so user can retry
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn('w-full justify-between', className)}
            disabled={disabled}
          >
            {selectedOption ? selectedOption.label : placeholder}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] p-0" align="start">
          <div className="p-2 border-b">
            <Input
              placeholder="Search or type to create..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="h-8"
              autoFocus
            />
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {filteredOptions.length === 0 && !showCreateOption ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No options found
              </div>
            ) : (
              <>
                {filteredOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onSelect={() => {
                      onValueChange(option.value);
                      setOpen(false);
                      setSearchValue('');
                    }}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === option.value ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {option.label}
                  </DropdownMenuItem>
                ))}
                {showCreateOption && (
                  <DropdownMenuItem
                    onSelect={() => {
                      setNewValue(searchValue);
                      setIsCreateDialogOpen(true);
                    }}
                    className="cursor-pointer text-primary font-medium"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create "{searchValue}"
                  </DropdownMenuItem>
                )}
              </>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{createLabel}</DialogTitle>
            <DialogDescription>
              Enter the details for the new item
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{inputLabel || 'Value'}</Label>
              <Input
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder={inputPlaceholder || 'Enter value...'}
                type={inputLabel?.toLowerCase().includes('email') ? 'email' : 'text'}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreate();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateDialogOpen(false);
              setNewValue('');
            }} disabled={isCreating}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isCreating || !newValue.trim()}>
              {isCreating ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

