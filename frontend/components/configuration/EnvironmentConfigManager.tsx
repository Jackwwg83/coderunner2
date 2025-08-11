import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Eye, EyeOff, Download, RefreshCw, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface EnvironmentVariable {
  id: string;
  key: string;
  value: string;
  isEncrypted: boolean;
  isRequired: boolean;
  description?: string;
  variableType: 'string' | 'number' | 'boolean' | 'secret' | 'url' | 'json';
  defaultValue?: string;
  createdAt: string;
  updatedAt: string;
}

interface EnvironmentConfig {
  id: string;
  projectId: string;
  environment: 'development' | 'staging' | 'production';
  name: string;
  description?: string;
  variables: EnvironmentVariable[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ConfigTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  framework?: string;
  isOfficial: boolean;
  usageCount: number;
  templateData: {
    variables: Array<{
      key: string;
      description: string;
      variableType: string;
      defaultValue?: string;
      isRequired: boolean;
      isEncrypted?: boolean;
      environments: string[];
    }>;
    environments: string[];
  };
}

interface EnvironmentConfigManagerProps {
  projectId: string;
  onConfigurationChange?: (configs: EnvironmentConfig[]) => void;
}

export default function EnvironmentConfigManager({ projectId, onConfigurationChange }: EnvironmentConfigManagerProps) {
  const [configurations, setConfigurations] = useState<EnvironmentConfig[]>([]);
  const [templates, setTemplates] = useState<ConfigTemplate[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<string>('');
  const [showNewVariable, setShowNewVariable] = useState(false);
  const [showNewConfig, setShowNewConfig] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [visibleValues, setVisibleValues] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const [newVariable, setNewVariable] = useState({
    key: '',
    value: '',
    isEncrypted: false,
    isRequired: false,
    description: '',
    variableType: 'string' as const
  });

  const [newConfig, setNewConfig] = useState({
    environment: 'development' as const,
    name: '',
    description: ''
  });

  // Load configurations on mount
  useEffect(() => {
    loadConfigurations();
    loadTemplates();
  }, [projectId]);

  const loadConfigurations = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      
      const response = await fetch(`/api/config/projects/${projectId}/environments`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setConfigurations(data.data || []);
        onConfigurationChange?.(data.data || []);
        
        // Auto-select first config if none selected
        if (data.data && data.data.length > 0 && !selectedConfig) {
          setSelectedConfig(data.data[0].id);
        }
      } else {
        throw new Error('Failed to load configurations');
      }
    } catch (error) {
      console.error('Failed to load configurations:', error);
      toast({
        title: 'Error',
        description: 'Failed to load environment configurations',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const token = localStorage.getItem('authToken');
      
      const response = await fetch('/api/config/templates', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTemplates(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const createConfiguration = async () => {
    try {
      const token = localStorage.getItem('authToken');
      
      const response = await fetch(`/api/config/projects/${projectId}/environments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newConfig)
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Success',
          description: 'Environment configuration created successfully'
        });
        
        setNewConfig({
          environment: 'development',
          name: '',
          description: ''
        });
        setShowNewConfig(false);
        loadConfigurations();
      } else {
        throw new Error('Failed to create configuration');
      }
    } catch (error) {
      console.error('Failed to create configuration:', error);
      toast({
        title: 'Error',
        description: 'Failed to create environment configuration',
        variant: 'destructive'
      });
    }
  };

  const setVariable = async () => {
    if (!selectedConfig || !newVariable.key) return;

    try {
      const token = localStorage.getItem('authToken');
      
      const response = await fetch(`/api/config/environments/${selectedConfig}/variables/${newVariable.key}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newVariable)
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Environment variable updated successfully'
        });
        
        setNewVariable({
          key: '',
          value: '',
          isEncrypted: false,
          isRequired: false,
          description: '',
          variableType: 'string'
        });
        setShowNewVariable(false);
        loadConfigurations();
      } else {
        throw new Error('Failed to set variable');
      }
    } catch (error) {
      console.error('Failed to set variable:', error);
      toast({
        title: 'Error',
        description: 'Failed to update environment variable',
        variant: 'destructive'
      });
    }
  };

  const deleteVariable = async (configId: string, key: string) => {
    if (!confirm(`Are you sure you want to delete the variable "${key}"?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      
      const response = await fetch(`/api/config/environments/${configId}/variables/${key}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Environment variable deleted successfully'
        });
        loadConfigurations();
      } else {
        throw new Error('Failed to delete variable');
      }
    } catch (error) {
      console.error('Failed to delete variable:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete environment variable',
        variant: 'destructive'
      });
    }
  };

  const applyTemplate = async (templateId: string, environment: string) => {
    try {
      const token = localStorage.getItem('authToken');
      
      const response = await fetch(`/api/config/projects/${projectId}/apply-template`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          templateId,
          environment,
          overrides: {}
        })
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Template applied successfully'
        });
        loadConfigurations();
        setShowTemplates(false);
      } else {
        throw new Error('Failed to apply template');
      }
    } catch (error) {
      console.error('Failed to apply template:', error);
      toast({
        title: 'Error',
        description: 'Failed to apply template',
        variant: 'destructive'
      });
    }
  };

  const exportConfiguration = async (configId: string, format: string) => {
    try {
      const token = localStorage.getItem('authToken');
      
      const response = await fetch(`/api/config/environments/${configId}/export?format=${format}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `config.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        
        toast({
          title: 'Success',
          description: 'Configuration exported successfully'
        });
      } else {
        throw new Error('Failed to export configuration');
      }
    } catch (error) {
      console.error('Failed to export configuration:', error);
      toast({
        title: 'Error',
        description: 'Failed to export configuration',
        variant: 'destructive'
      });
    }
  };

  const toggleValueVisibility = (variableId: string) => {
    const newVisible = new Set(visibleValues);
    if (newVisible.has(variableId)) {
      newVisible.delete(variableId);
    } else {
      newVisible.add(variableId);
    }
    setVisibleValues(newVisible);
  };

  const selectedConfigData = configurations.find(c => c.id === selectedConfig);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Environment Configuration</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowTemplates(true)}>
            Apply Template
          </Button>
          <Button variant="outline" onClick={() => setShowNewConfig(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Environment
          </Button>
          <Button variant="outline" onClick={loadConfigurations} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Environment Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Environments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {configurations.map((config) => (
              <div
                key={config.id}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedConfig === config.id
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedConfig(config.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <Badge variant={config.environment === 'production' ? 'destructive' : 
                                 config.environment === 'staging' ? 'default' : 'secondary'}>
                    {config.environment}
                  </Badge>
                  {config.isActive && <Badge variant="outline">Active</Badge>}
                </div>
                <h4 className="font-medium">{config.name}</h4>
                <p className="text-sm text-gray-600 mt-1">{config.description}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {config.variables.length} variables
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Variables Management */}
      {selectedConfigData && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Environment Variables</CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedConfigData.environment.toUpperCase()} - {selectedConfigData.name}
                </p>
              </div>
              <div className="flex gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Export Configuration</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <p className="text-sm text-gray-600">
                        Choose the format for exporting your configuration:
                      </p>
                      <div className="flex gap-2">
                        <Button 
                          onClick={() => exportConfiguration(selectedConfigData.id, 'env')}
                          variant="outline"
                        >
                          .env format
                        </Button>
                        <Button 
                          onClick={() => exportConfiguration(selectedConfigData.id, 'json')}
                          variant="outline"
                        >
                          JSON format
                        </Button>
                        <Button 
                          onClick={() => exportConfiguration(selectedConfigData.id, 'yaml')}
                          variant="outline"
                        >
                          YAML format
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button 
                  onClick={() => setShowNewVariable(!showNewVariable)}
                  variant="default"
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Variable
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Add New Variable Form */}
            {showNewVariable && (
              <div className="border rounded-lg p-4 mb-4 bg-gray-50">
                <h4 className="font-medium mb-3">Add New Variable</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="variable-key">Key</Label>
                    <Input
                      id="variable-key"
                      placeholder="VARIABLE_NAME"
                      value={newVariable.key}
                      onChange={(e) => setNewVariable({...newVariable, key: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="variable-type">Type</Label>
                    <Select 
                      value={newVariable.variableType} 
                      onValueChange={(value: any) => setNewVariable({...newVariable, variableType: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="string">String</SelectItem>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="boolean">Boolean</SelectItem>
                        <SelectItem value="secret">Secret</SelectItem>
                        <SelectItem value="url">URL</SelectItem>
                        <SelectItem value="json">JSON</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="variable-value">Value</Label>
                    <Input
                      id="variable-value"
                      placeholder="Variable value"
                      type={newVariable.variableType === 'secret' ? 'password' : 'text'}
                      value={newVariable.value}
                      onChange={(e) => setNewVariable({...newVariable, value: e.target.value})}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="variable-description">Description (Optional)</Label>
                    <Textarea
                      id="variable-description"
                      placeholder="Describe what this variable is used for..."
                      value={newVariable.description}
                      onChange={(e) => setNewVariable({...newVariable, description: e.target.value})}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="variable-encrypted"
                      checked={newVariable.isEncrypted || newVariable.variableType === 'secret'}
                      onCheckedChange={(checked) => setNewVariable({...newVariable, isEncrypted: checked})}
                      disabled={newVariable.variableType === 'secret'}
                    />
                    <Label htmlFor="variable-encrypted">Encrypt Value</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="variable-required"
                      checked={newVariable.isRequired}
                      onCheckedChange={(checked) => setNewVariable({...newVariable, isRequired: checked})}
                    />
                    <Label htmlFor="variable-required">Required</Label>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button onClick={setVariable} disabled={!newVariable.key || !newVariable.value}>
                    Add Variable
                  </Button>
                  <Button variant="outline" onClick={() => setShowNewVariable(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Variables List */}
            <div className="space-y-3">
              {selectedConfigData.variables.map((variable) => (
                <div
                  key={variable.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-sm font-medium bg-gray-100 px-2 py-1 rounded">
                        {variable.key}
                      </code>
                      {variable.isRequired && <Badge variant="secondary" className="text-xs">Required</Badge>}
                      {variable.isEncrypted && <Badge variant="outline" className="text-xs">Encrypted</Badge>}
                      <Badge variant="outline" className="text-xs">{variable.variableType}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-sm text-gray-600 truncate max-w-xs">
                        {variable.isEncrypted && !visibleValues.has(variable.id) 
                          ? '***ENCRYPTED***' 
                          : variable.value}
                      </code>
                      {variable.isEncrypted && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleValueVisibility(variable.id)}
                          className="h-6 w-6 p-0"
                        >
                          {visibleValues.has(variable.id) ? 
                            <EyeOff className="h-3 w-3" /> : 
                            <Eye className="h-3 w-3" />
                          }
                        </Button>
                      )}
                    </div>
                    {variable.description && (
                      <p className="text-xs text-gray-500 mt-1">{variable.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                      <Clock className="h-3 w-3" />
                      Updated {new Date(variable.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteVariable(selectedConfigData.id, variable.key)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              
              {selectedConfigData.variables.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No environment variables configured.
                  Add your first variable using the button above.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* New Configuration Dialog */}
      <Dialog open={showNewConfig} onOpenChange={setShowNewConfig}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Environment Configuration</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="config-environment">Environment</Label>
              <Select 
                value={newConfig.environment} 
                onValueChange={(value: any) => setNewConfig({...newConfig, environment: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="development">Development</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="config-name">Name</Label>
              <Input
                id="config-name"
                placeholder="e.g., Development Configuration"
                value={newConfig.name}
                onChange={(e) => setNewConfig({...newConfig, name: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="config-description">Description (Optional)</Label>
              <Textarea
                id="config-description"
                placeholder="Describe this configuration..."
                value={newConfig.description}
                onChange={(e) => setNewConfig({...newConfig, description: e.target.value})}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowNewConfig(false)}>
                Cancel
              </Button>
              <Button onClick={createConfiguration} disabled={!newConfig.name}>
                Create Configuration
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Templates Dialog */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Apply Configuration Template</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((template) => (
              <div key={template.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{template.name}</h4>
                  <div className="flex gap-1">
                    {template.isOfficial && <Badge variant="default" className="text-xs">Official</Badge>}
                    <Badge variant="outline" className="text-xs">{template.category}</Badge>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                <p className="text-xs text-gray-500 mb-3">
                  {template.templateData.variables.length} variables • Used {template.usageCount} times
                </p>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => applyTemplate(template.id, 'development')}
                  >
                    Development
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => applyTemplate(template.id, 'staging')}
                  >
                    Staging
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => applyTemplate(template.id, 'production')}
                  >
                    Production
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}