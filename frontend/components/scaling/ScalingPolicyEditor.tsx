'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  CheckCircle, 
  Info,
  Save,
  RotateCcw
} from 'lucide-react';

interface MetricThreshold {
  metric: 'cpu' | 'memory' | 'requests' | 'response_time' | 'error_rate';
  threshold: number;
  comparison: 'gt' | 'lt' | 'gte' | 'lte';
  weight: number;
}

interface ScalingPolicy {
  name: string;
  metrics: MetricThreshold[];
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  cooldownPeriod: number;
  minInstances: number;
  maxInstances: number;
  isEnabled: boolean;
}

interface PolicyTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  metrics: MetricThreshold[];
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  cooldownPeriod: number;
  minInstances: number;
  maxInstances: number;
  tags: string[];
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
}

interface Props {
  deploymentId: string;
  existingPolicy?: ScalingPolicy;
  onSave?: (policy: ScalingPolicy) => void;
  onCancel?: () => void;
  className?: string;
}

export default function ScalingPolicyEditor({ deploymentId, existingPolicy, onSave, onCancel, className }: Props) {
  const [policy, setPolicy] = useState<ScalingPolicy>({
    name: '',
    metrics: [],
    scaleUpThreshold: 0.7,
    scaleDownThreshold: 0.3,
    cooldownPeriod: 300,
    minInstances: 1,
    maxInstances: 10,
    isEnabled: true
  });

  const [templates, setTemplates] = useState<PolicyTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [validation, setValidation] = useState<ValidationResult>({
    isValid: true,
    errors: [],
    warnings: [],
    recommendations: []
  });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('template');

  useEffect(() => {
    loadTemplates();
    if (existingPolicy) {
      setPolicy(existingPolicy);
      setActiveTab('custom');
    }
  }, [existingPolicy]);

  useEffect(() => {
    validatePolicy();
  }, [policy]);

  const loadTemplates = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/scaling/policy-templates', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const validatePolicy = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/scaling/policy-templates/validate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(policy)
      });

      if (response.ok) {
        const result = await response.json();
        setValidation(result);
      }
    } catch (error) {
      console.error('Failed to validate policy:', error);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setPolicy({
        name: template.name,
        metrics: [...template.metrics],
        scaleUpThreshold: template.scaleUpThreshold,
        scaleDownThreshold: template.scaleDownThreshold,
        cooldownPeriod: template.cooldownPeriod,
        minInstances: template.minInstances,
        maxInstances: template.maxInstances,
        isEnabled: true
      });
      setSelectedTemplate(templateId);
    }
  };

  const handleAddMetric = () => {
    setPolicy(prev => ({
      ...prev,
      metrics: [
        ...prev.metrics,
        {
          metric: 'cpu',
          threshold: 0.7,
          comparison: 'gt',
          weight: 0.25
        }
      ]
    }));
  };

  const handleRemoveMetric = (index: number) => {
    setPolicy(prev => ({
      ...prev,
      metrics: prev.metrics.filter((_, i) => i !== index)
    }));
  };

  const handleMetricChange = (index: number, field: keyof MetricThreshold, value: any) => {
    setPolicy(prev => ({
      ...prev,
      metrics: prev.metrics.map((metric, i) => 
        i === index ? { ...metric, [field]: value } : metric
      )
    }));
  };

  const handleSave = async () => {
    if (!validation.isValid) {
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const body = selectedTemplate ? 
        { templateId: selectedTemplate, ...policy } : 
        policy;

      const response = await fetch(`/api/deployments/${deploymentId}/scaling/policy`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        const result = await response.json();
        onSave?.(result.policy);
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save policy');
      }
    } catch (error) {
      console.error('Failed to save policy:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (existingPolicy) {
      setPolicy(existingPolicy);
    } else {
      setPolicy({
        name: '',
        metrics: [],
        scaleUpThreshold: 0.7,
        scaleDownThreshold: 0.3,
        cooldownPeriod: 300,
        minInstances: 1,
        maxInstances: 10,
        isEnabled: true
      });
    }
    setSelectedTemplate('');
  };

  const metricLabels = {
    cpu: 'CPU Usage',
    memory: 'Memory Usage',
    requests: 'Request Rate',
    response_time: 'Response Time',
    error_rate: 'Error Rate'
  };

  const comparisonLabels = {
    gt: 'Greater Than',
    gte: 'Greater Than or Equal',
    lt: 'Less Than',
    lte: 'Less Than or Equal'
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {existingPolicy ? 'Edit' : 'Create'} Scaling Policy
          </h2>
          <p className="text-muted-foreground">
            Configure auto-scaling behavior for deployment {deploymentId}
          </p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={handleReset} variant="outline">
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
          <Button onClick={onCancel} variant="outline">
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!validation.isValid || saving}
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save Policy'}
          </Button>
        </div>
      </div>

      {/* Validation Alerts */}
      {validation.errors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Validation Errors:</strong>
            <ul className="mt-1 ml-4 list-disc">
              {validation.errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {validation.warnings.length > 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Warnings:</strong>
            <ul className="mt-1 ml-4 list-disc">
              {validation.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="template">From Template</TabsTrigger>
          <TabsTrigger value="custom">Custom Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="template" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Choose a Template</CardTitle>
              <CardDescription>
                Start with a pre-configured policy template optimized for different workloads
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {templates.map((template) => (
                  <Card 
                    key={template.id} 
                    className={`cursor-pointer transition-colors hover:bg-muted ${
                      selectedTemplate === template.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => handleTemplateSelect(template.id)}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      <Badge variant="outline" className="w-fit">
                        {template.category}
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-3">
                        {template.description}
                      </p>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span>Scale Up:</span>
                          <span>{(template.scaleUpThreshold * 100).toFixed(0)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Scale Down:</span>
                          <span>{(template.scaleDownThreshold * 100).toFixed(0)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Instances:</span>
                          <span>{template.minInstances}-{template.maxInstances}</span>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {template.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {selectedTemplate && (
            <Card>
              <CardHeader>
                <CardTitle>Template Customization</CardTitle>
                <CardDescription>
                  Customize the selected template to match your specific requirements
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="template-name">Policy Name</Label>
                    <Input
                      id="template-name"
                      value={policy.name}
                      onChange={(e) => setPolicy(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter policy name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="template-enabled">Enabled</Label>
                    <Switch
                      id="template-enabled"
                      checked={policy.isEnabled}
                      onCheckedChange={(checked) => setPolicy(prev => ({ ...prev, isEnabled: checked }))}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Scale Up Threshold: {(policy.scaleUpThreshold * 100).toFixed(0)}%</Label>
                    <Slider
                      value={[policy.scaleUpThreshold]}
                      onValueChange={([value]) => setPolicy(prev => ({ ...prev, scaleUpThreshold: value }))}
                      max={1}
                      min={0.1}
                      step={0.05}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Scale Down Threshold: {(policy.scaleDownThreshold * 100).toFixed(0)}%</Label>
                    <Slider
                      value={[policy.scaleDownThreshold]}
                      onValueChange={([value]) => setPolicy(prev => ({ ...prev, scaleDownThreshold: value }))}
                      max={0.8}
                      min={0.05}
                      step={0.05}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="template-cooldown">Cooldown Period (seconds)</Label>
                    <Input
                      id="template-cooldown"
                      type="number"
                      value={policy.cooldownPeriod}
                      onChange={(e) => setPolicy(prev => ({ ...prev, cooldownPeriod: parseInt(e.target.value) }))}
                      min="60"
                      max="3600"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="template-min">Min Instances</Label>
                    <Input
                      id="template-min"
                      type="number"
                      value={policy.minInstances}
                      onChange={(e) => setPolicy(prev => ({ ...prev, minInstances: parseInt(e.target.value) }))}
                      min="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="template-max">Max Instances</Label>
                    <Input
                      id="template-max"
                      type="number"
                      value={policy.maxInstances}
                      onChange={(e) => setPolicy(prev => ({ ...prev, maxInstances: parseInt(e.target.value) }))}
                      min={policy.minInstances}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="custom" className="space-y-4">
          {/* Basic Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Configuration</CardTitle>
              <CardDescription>
                Set up the basic parameters for your scaling policy
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="policy-name">Policy Name</Label>
                  <Input
                    id="policy-name"
                    value={policy.name}
                    onChange={(e) => setPolicy(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter policy name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="policy-enabled">Enabled</Label>
                  <Switch
                    id="policy-enabled"
                    checked={policy.isEnabled}
                    onCheckedChange={(checked) => setPolicy(prev => ({ ...prev, isEnabled: checked }))}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Scale Up Threshold: {(policy.scaleUpThreshold * 100).toFixed(0)}%</Label>
                  <Slider
                    value={[policy.scaleUpThreshold]}
                    onValueChange={([value]) => setPolicy(prev => ({ ...prev, scaleUpThreshold: value }))}
                    max={1}
                    min={0.1}
                    step={0.05}
                  />
                  <p className="text-xs text-muted-foreground">
                    Trigger scaling up when weighted score exceeds this threshold
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Scale Down Threshold: {(policy.scaleDownThreshold * 100).toFixed(0)}%</Label>
                  <Slider
                    value={[policy.scaleDownThreshold]}
                    onValueChange={([value]) => setPolicy(prev => ({ ...prev, scaleDownThreshold: value }))}
                    max={0.8}
                    min={0.05}
                    step={0.05}
                  />
                  <p className="text-xs text-muted-foreground">
                    Trigger scaling down when weighted score falls below this threshold
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="cooldown">Cooldown Period (seconds)</Label>
                  <Input
                    id="cooldown"
                    type="number"
                    value={policy.cooldownPeriod}
                    onChange={(e) => setPolicy(prev => ({ ...prev, cooldownPeriod: parseInt(e.target.value) }))}
                    min="60"
                    max="3600"
                  />
                  <p className="text-xs text-muted-foreground">
                    Wait time between scaling actions
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="min-instances">Min Instances</Label>
                  <Input
                    id="min-instances"
                    type="number"
                    value={policy.minInstances}
                    onChange={(e) => setPolicy(prev => ({ ...prev, minInstances: parseInt(e.target.value) }))}
                    min="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-instances">Max Instances</Label>
                  <Input
                    id="max-instances"
                    type="number"
                    value={policy.maxInstances}
                    onChange={(e) => setPolicy(prev => ({ ...prev, maxInstances: parseInt(e.target.value) }))}
                    min={policy.minInstances}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Metrics Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Metrics Configuration
                <Button onClick={handleAddMetric} size="sm" variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Metric
                </Button>
              </CardTitle>
              <CardDescription>
                Define the metrics that will trigger scaling decisions. Total weights should sum to 1.0.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {policy.metrics.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No metrics configured. Add at least one metric to enable auto-scaling.
                </div>
              ) : (
                <div className="space-y-4">
                  {policy.metrics.map((metric, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium">Metric {index + 1}</h4>
                        <Button
                          onClick={() => handleRemoveMetric(index)}
                          size="sm"
                          variant="outline"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="grid gap-4 md:grid-cols-4">
                        <div className="space-y-2">
                          <Label>Metric Type</Label>
                          <Select
                            value={metric.metric}
                            onValueChange={(value) => handleMetricChange(index, 'metric', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(metricLabels).map(([key, label]) => (
                                <SelectItem key={key} value={key}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Comparison</Label>
                          <Select
                            value={metric.comparison}
                            onValueChange={(value) => handleMetricChange(index, 'comparison', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(comparisonLabels).map(([key, label]) => (
                                <SelectItem key={key} value={key}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Threshold: {(metric.threshold * 100).toFixed(0)}%</Label>
                          <Slider
                            value={[metric.threshold]}
                            onValueChange={([value]) => handleMetricChange(index, 'threshold', value)}
                            max={1}
                            min={0.05}
                            step={0.05}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Weight: {(metric.weight * 100).toFixed(0)}%</Label>
                          <Slider
                            value={[metric.weight]}
                            onValueChange={([value]) => handleMetricChange(index, 'weight', value)}
                            max={1}
                            min={0.05}
                            step={0.05}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Weight Summary */}
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Total Weight:</span>
                      <Badge 
                        variant={
                          Math.abs(policy.metrics.reduce((sum, m) => sum + m.weight, 0) - 1) < 0.01 
                            ? "default" 
                            : "destructive"
                        }
                      >
                        {(policy.metrics.reduce((sum, m) => sum + m.weight, 0) * 100).toFixed(0)}%
                      </Badge>
                    </div>
                    {Math.abs(policy.metrics.reduce((sum, m) => sum + m.weight, 0) - 1) >= 0.01 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Weights should sum to 100% for optimal scaling decisions
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recommendations */}
          {validation.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CheckCircle className="mr-2 h-5 w-5 text-green-500" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {validation.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <Info className="h-4 w-4 text-blue-500 mt-0.5" />
                      <span className="text-sm">{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}