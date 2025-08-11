'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  Settings, 
  DollarSign, 
  Activity,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { format } from 'date-fns';

interface ScalingStatus {
  currentInstances: number;
  targetInstances: number;
  policy: ScalingPolicy | null;
  lastDecision: ScalingDecision | null;
  cooldownUntil: Date | null;
  isAutoScalingEnabled: boolean;
}

interface ScalingPolicy {
  id: string;
  name: string;
  metrics: MetricThreshold[];
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  cooldownPeriod: number;
  minInstances: number;
  maxInstances: number;
  isEnabled: boolean;
}

interface MetricThreshold {
  metric: string;
  threshold: number;
  comparison: string;
  weight: number;
}

interface ScalingDecision {
  action: 'scale_up' | 'scale_down' | 'no_change';
  targetInstances: number;
  confidence: number;
  reason: string;
  triggeredMetrics: string[];
}

interface ScalingEvent {
  id: string;
  eventType: string;
  fromInstances: number;
  toInstances: number;
  reason: string;
  createdAt: string;
}

interface ResourceUsage {
  cpuUsage: number;
  memoryUsage: number;
  networkIO: number;
  diskIO: number;
  costEstimate: number;
  timestamp: string;
}

interface OptimizationRecommendation {
  id: string;
  type: string;
  priority: string;
  title: string;
  description: string;
  impact: {
    costSavings: number;
    performanceImprovement: number;
    efficiency: number;
  };
  implementation: {
    effort: string;
    risk: string;
    steps: string[];
  };
  isImplemented: boolean;
}

interface Props {
  deploymentId: string;
  className?: string;
}

export default function AutoScalingDashboard({ deploymentId, className }: Props) {
  const [scalingStatus, setScalingStatus] = useState<ScalingStatus | null>(null);
  const [scalingHistory, setScalingHistory] = useState<ScalingEvent[]>([]);
  const [resourceUsage, setResourceUsage] = useState<ResourceUsage[]>([]);
  const [recommendations, setRecommendations] = useState<OptimizationRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('status');

  useEffect(() => {
    if (deploymentId) {
      loadScalingData();
      
      // Set up polling for real-time updates
      const interval = setInterval(loadScalingData, 30000); // 30 seconds
      return () => clearInterval(interval);
    }
  }, [deploymentId]);

  const loadScalingData = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };

      // Load scaling status
      const statusResponse = await fetch(`/api/deployments/${deploymentId}/scaling/status`, { headers });
      if (!statusResponse.ok) throw new Error('Failed to load scaling status');
      const statusData = await statusResponse.json();
      setScalingStatus(statusData);

      // Load scaling history
      const historyResponse = await fetch(`/api/deployments/${deploymentId}/scaling/history?limit=20`, { headers });
      if (!historyResponse.ok) throw new Error('Failed to load scaling history');
      const historyData = await historyResponse.json();
      setScalingHistory(historyData.events);

      // Load resource usage
      const usageResponse = await fetch(`/api/deployments/${deploymentId}/resources/usage?hours=24`, { headers });
      if (!usageResponse.ok) throw new Error('Failed to load resource usage');
      const usageData = await usageResponse.json();
      setResourceUsage(usageData.historical);

      // Load optimization recommendations
      const optimizeResponse = await fetch(`/api/deployments/${deploymentId}/resources/optimize`, { headers });
      if (!optimizeResponse.ok) throw new Error('Failed to load recommendations');
      const optimizeData = await optimizeResponse.json();
      setRecommendations(optimizeData.recommendations);

    } catch (err) {
      console.error('Failed to load scaling data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load scaling data');
    } finally {
      setLoading(false);
    }
  };

  const handleManualScale = async (targetInstances: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/deployments/${deploymentId}/scaling/manual`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          targetInstances,
          reason: `Manual scaling to ${targetInstances} instances via dashboard`
        })
      });

      if (!response.ok) throw new Error('Failed to execute manual scaling');
      
      // Reload data to reflect changes
      await loadScalingData();
    } catch (err) {
      console.error('Manual scaling failed:', err);
      setError(err instanceof Error ? err.message : 'Manual scaling failed');
    }
  };

  const getStatusColor = (action: string) => {
    switch (action) {
      case 'scale_up': return 'text-green-600';
      case 'scale_down': return 'text-blue-600';
      case 'no_change': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (action: string) => {
    switch (action) {
      case 'scale_up': return <TrendingUp className="h-4 w-4" />;
      case 'scale_down': return <TrendingDown className="h-4 w-4" />;
      case 'no_change': return <Activity className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="h-32 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Auto-scaling Dashboard</h2>
          <p className="text-muted-foreground">
            Monitor and manage auto-scaling for deployment {deploymentId}
          </p>
        </div>
        <Button onClick={() => loadScalingData()} variant="outline">
          <Activity className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="status">Status</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="optimize">Optimize</TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="space-y-4">
          {/* Current Status */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Current Instances</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{scalingStatus?.currentInstances || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Min: {scalingStatus?.policy?.minInstances || 1}, Max: {scalingStatus?.policy?.maxInstances || 10}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Auto-scaling</CardTitle>
                {scalingStatus?.isAutoScalingEnabled ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {scalingStatus?.isAutoScalingEnabled ? 'Enabled' : 'Disabled'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {scalingStatus?.policy?.name || 'No active policy'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Last Action</CardTitle>
                {scalingStatus?.lastDecision && getStatusIcon(scalingStatus.lastDecision.action)}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold capitalize ${scalingStatus?.lastDecision ? getStatusColor(scalingStatus.lastDecision.action) : ''}`}>
                  {scalingStatus?.lastDecision?.action.replace('_', ' ') || 'None'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Confidence: {scalingStatus?.lastDecision ? (scalingStatus.lastDecision.confidence * 100).toFixed(0) : 0}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cooldown</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {scalingStatus?.cooldownUntil ? 'Active' : 'None'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Period: {scalingStatus?.policy?.cooldownPeriod || 0}s
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Manual Scaling */}
          <Card>
            <CardHeader>
              <CardTitle>Manual Scaling</CardTitle>
              <CardDescription>
                Override auto-scaling with manual instance count adjustment
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleManualScale((scalingStatus?.currentInstances || 1) - 1)}
                  disabled={!scalingStatus || scalingStatus.currentInstances <= (scalingStatus.policy?.minInstances || 1)}
                >
                  <TrendingDown className="h-4 w-4 mr-2" />
                  Scale Down
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleManualScale((scalingStatus?.currentInstances || 1) + 1)}
                  disabled={!scalingStatus || scalingStatus.currentInstances >= (scalingStatus.policy?.maxInstances || 10)}
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Scale Up
                </Button>
              </div>
              {scalingStatus?.lastDecision && (
                <Alert>
                  <AlertDescription>
                    <strong>Last Decision:</strong> {scalingStatus.lastDecision.reason}
                    {scalingStatus.lastDecision.triggeredMetrics.length > 0 && (
                      <span className="block text-sm text-muted-foreground mt-1">
                        Triggered metrics: {scalingStatus.lastDecision.triggeredMetrics.join(', ')}
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          {/* Resource Usage Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Resource Usage (24h)</CardTitle>
              <CardDescription>CPU and Memory utilization over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={resourceUsage.slice(-48).map(usage => ({
                  time: format(new Date(usage.timestamp), 'HH:mm'),
                  cpu: usage.cpuUsage,
                  memory: usage.memoryUsage,
                  cost: usage.costEstimate
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="cpu" stroke="#8884d8" name="CPU %" />
                  <Line type="monotone" dataKey="memory" stroke="#82ca9d" name="Memory %" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Cost Tracking */}
          <Card>
            <CardHeader>
              <CardTitle>Cost Tracking</CardTitle>
              <CardDescription>Hourly cost estimates over the last 24 hours</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={resourceUsage.slice(-24).map(usage => ({
                  time: format(new Date(usage.timestamp), 'HH:mm'),
                  cost: usage.costEstimate
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip formatter={(value) => [formatCurrency(value as number), 'Cost/hour']} />
                  <Area type="monotone" dataKey="cost" stroke="#ff7300" fill="#ff7300" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Policy Configuration */}
          {scalingStatus?.policy && (
            <Card>
              <CardHeader>
                <CardTitle>Active Policy: {scalingStatus.policy.name}</CardTitle>
                <CardDescription>Current scaling policy configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="font-semibold mb-2">Thresholds</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Scale Up:</span>
                        <Badge variant="secondary">{(scalingStatus.policy.scaleUpThreshold * 100).toFixed(0)}%</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Scale Down:</span>
                        <Badge variant="secondary">{(scalingStatus.policy.scaleDownThreshold * 100).toFixed(0)}%</Badge>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Instance Limits</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Minimum:</span>
                        <Badge variant="outline">{scalingStatus.policy.minInstances}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Maximum:</span>
                        <Badge variant="outline">{scalingStatus.policy.maxInstances}</Badge>
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Metrics</h4>
                  <div className="space-y-2">
                    {scalingStatus.policy.metrics.map((metric, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                        <span className="capitalize">{metric.metric.replace('_', ' ')}</span>
                        <div className="flex items-center space-x-2">
                          <Badge variant="secondary">{(metric.threshold * 100).toFixed(0)}%</Badge>
                          <Badge variant="outline">Weight: {(metric.weight * 100).toFixed(0)}%</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Scaling Events</CardTitle>
              <CardDescription>Recent auto-scaling activities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {scalingHistory.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No scaling events yet</p>
                ) : (
                  scalingHistory.map((event) => (
                    <div key={event.id} className="flex items-center space-x-4 p-4 border rounded-lg">
                      <div className={`${getStatusColor(event.eventType)}`}>
                        {getStatusIcon(event.eventType)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium capitalize">
                            {event.eventType.replace('_', ' ')}
                          </h4>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(event.createdAt), 'MMM dd, HH:mm')}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Scaled from {event.fromInstances} to {event.toInstances} instances
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {event.reason}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="optimize" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Optimization Recommendations</CardTitle>
              <CardDescription>AI-generated suggestions for cost and performance optimization</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recommendations.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No recommendations available</p>
                ) : (
                  recommendations.map((rec) => (
                    <div key={rec.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{rec.title}</h4>
                        <Badge variant={getPriorityColor(rec.priority)}>{rec.priority}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{rec.description}</p>
                      
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="text-center p-3 bg-muted rounded">
                          <div className="text-lg font-semibold text-green-600">
                            {formatCurrency(rec.impact.costSavings)}
                          </div>
                          <div className="text-xs text-muted-foreground">Monthly Savings</div>
                        </div>
                        <div className="text-center p-3 bg-muted rounded">
                          <div className="text-lg font-semibold text-blue-600">
                            {rec.impact.performanceImprovement.toFixed(0)}%
                          </div>
                          <div className="text-xs text-muted-foreground">Performance</div>
                        </div>
                        <div className="text-center p-3 bg-muted rounded">
                          <div className="text-lg font-semibold text-purple-600">
                            {rec.impact.efficiency.toFixed(0)}%
                          </div>
                          <div className="text-xs text-muted-foreground">Efficiency</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <div className="flex space-x-4">
                          <span>Effort: <Badge variant="outline">{rec.implementation.effort}</Badge></span>
                          <span>Risk: <Badge variant="outline">{rec.implementation.risk}</Badge></span>
                        </div>
                        <Button variant="outline" size="sm">
                          <Settings className="mr-2 h-4 w-4" />
                          Implement
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}