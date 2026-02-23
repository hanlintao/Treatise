import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import * as echarts from 'echarts';
import { API_BASE_URL } from '../utils/api';
import { 
  BookOpen, FileText, Database, Layers, Brain, 
  TrendingUp, Activity, Clock, Calendar
} from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, trend, color = "bg-white" }) => (
  <div className={`${color} p-6 rounded-xl shadow-sm border border-slate-100`}>
    <div className="flex items-center justify-between mb-4">
      <div className="p-2 rounded-lg bg-white/50">
        <Icon className="w-6 h-6 text-slate-700" />
      </div>
      {trend && (
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
          trend > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {trend > 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
    <div className="text-3xl font-bold text-slate-800 mb-1">{value}</div>
    <div className="text-sm text-slate-500">{title}</div>
  </div>
);

export function Dashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const activityChartRef = useRef(null);
  const distributionChartRef = useRef(null);
  const conceptsChartRef = useRef(null);
  const chartInstances = useRef([]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/dashboard/stats`)
      .then(res => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch dashboard stats", err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Initialize Charts
  useEffect(() => {
    if (!stats || loading) return;

    // Cleanup previous instances
    chartInstances.current.forEach(instance => instance.dispose());
    chartInstances.current = [];

    const initChart = (ref, options) => {
        if (ref.current) {
            const chart = echarts.init(ref.current);
            chart.setOption(options);
            chartInstances.current.push(chart);
        }
    };

    // 1. Activity Trends
    if (activityChartRef.current) {
        const dates = stats.trends?.activity?.map(i => new Date(i.date).toLocaleDateString()) || [];
        const counts = stats.trends?.activity?.map(i => i.count) || [];
        
        initChart(activityChartRef, {
            tooltip: { trigger: 'axis' },
            grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
            xAxis: { 
                type: 'category', 
                boundaryGap: false, 
                data: dates,
                axisLine: { lineStyle: { color: '#e2e8f0' } },
                axisLabel: { color: '#64748b' }
            },
            yAxis: { 
                type: 'value',
                splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } },
                axisLabel: { color: '#64748b' }
            },
            series: [{
                name: t('dashboard.activity_trends'),
                type: 'line',
                smooth: true,
                symbol: 'none',
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(59, 130, 246, 0.2)' },
                        { offset: 1, color: 'rgba(59, 130, 246, 0)' }
                    ])
                },
                lineStyle: { width: 3, color: '#3b82f6' },
                data: counts
            }]
        });
    }

    // 2. Asset Distribution
    if (distributionChartRef.current) {
        const data = [
            { value: stats.counts?.references || 0, name: t('chapter.references') || '文献', itemStyle: { color: '#60a5fa' } },
            { value: stats.counts?.knowledge || 0, name: t('sidebar.knowledge_system') || '知识', itemStyle: { color: '#a78bfa' } },
            { value: stats.counts?.notes || 0, name: t('dashboard.notes'), itemStyle: { color: '#f472b6' } },
            { value: stats.counts?.inspirations || 0, name: t('sidebar.inspirations') || '灵感', itemStyle: { color: '#fbbf24' } },
            { value: stats.counts?.weibo || 0, name: t('dashboard.weibo'), itemStyle: { color: '#34d399' } }
        ].filter(i => i.value > 0);

        initChart(distributionChartRef, {
            tooltip: { trigger: 'item' },
            legend: { bottom: '0%', left: 'center', icon: 'circle' },
            series: [{
                name: t('dashboard.asset_distribution'),
                type: 'pie',
                radius: ['40%', '70%'],
                avoidLabelOverlap: false,
                itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
                label: { show: false, position: 'center' },
                emphasis: { label: { show: true, fontSize: 18, fontWeight: 'bold' } },
                data: data
            }]
        });
    }

    // 3. Concepts/Keywords (Horizontal Bar)
    if (conceptsChartRef.current) {
        const concepts = (stats.trends?.concepts || []).slice(0, 10); // Top 10
        initChart(conceptsChartRef, {
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            grid: { left: '3%', right: '4%', bottom: '3%', top: '3%', containLabel: true },
            xAxis: { type: 'value', show: false },
            yAxis: { 
                type: 'category', 
                data: concepts.map(c => c.name),
                axisTick: { show: false },
                axisLine: { show: false },
                axisLabel: { color: '#64748b' }
            },
            series: [{
                name: t('dashboard.citation_count'),
                type: 'bar',
                data: concepts.map(c => c.value),
                barWidth: 12,
                itemStyle: { borderRadius: [0, 6, 6, 0], color: '#10b981' },
                label: { show: true, position: 'right', color: '#64748b' }
            }]
        });
    }

    const handleResize = () => {
        chartInstances.current.forEach(chart => chart.resize());
    };
    window.addEventListener('resize', handleResize);

    return () => {
        window.removeEventListener('resize', handleResize);
        chartInstances.current.forEach(instance => instance.dispose());
    };
  }, [stats, loading, t]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <div className="text-slate-500 animate-pulse">{t('dashboard.loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <div className="bg-red-50 p-6 rounded-lg border border-red-100 text-center">
            <h3 className="text-red-700 font-semibold mb-2">{t('dashboard.error')}</h3>
            <p className="text-red-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-8">
      <div className="max-w-[1600px] mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{t('dashboard.title')}</h1>
            <p className="text-slate-500 mt-1">{t('dashboard.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
            <Calendar className="w-4 h-4" />
            {new Date().toLocaleDateString()}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            title={t('dashboard.total_references')} 
            value={stats.counts?.references || 0} 
            icon={BookOpen} 
            color="bg-blue-50"
          />
          <StatCard 
            title={t('dashboard.knowledge_cards')} 
            value={stats.counts?.knowledge || 0} 
            icon={Database} 
            color="bg-violet-50"
          />
          <StatCard 
            title={t('dashboard.chapters')} 
            value={stats.counts?.chapters || 0} 
            icon={FileText} 
            color="bg-emerald-50"
          />
          <StatCard 
            title={t('dashboard.research_sessions')} 
            value={stats.counts?.researchSessions || 0} 
            icon={Brain} 
            color="bg-amber-50"
          />
        </div>

        {/* Charts Section 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Activity Trend */}
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500" />
              {t('dashboard.activity_trends')}
            </h3>
            <div ref={activityChartRef} className="h-[300px] w-full" />
          </div>

          {/* Asset Distribution */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
              <Layers className="w-5 h-5 text-violet-500" />
              {t('dashboard.asset_distribution')}
            </h3>
            <div ref={distributionChartRef} className="h-[300px] w-full" />
          </div>
        </div>

        {/* Charts Section 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           {/* Top Tags/Keywords */}
           <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                {t('dashboard.term_growth')}
              </h3>
              <div ref={conceptsChartRef} className="h-[300px] w-full" />
           </div>

           {/* Recent Research Topics */}
           <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                {t('dashboard.recent_research')}
              </h3>
              <div className="space-y-4 max-h-[300px] overflow-y-auto">
                {(stats.recentResearch || []).map((session, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                     <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-xs font-bold text-slate-600 shadow-sm shrink-0">
                           {i + 1}
                        </div>
                        <div className="truncate text-sm font-medium text-slate-700">
                           {session.title || t('dashboard.untitled_session')}
                        </div>
                     </div>
                     <div className="text-xs text-slate-400 shrink-0">
                        {new Date(session.updatedAt || Date.now()).toLocaleDateString()}
                     </div>
                  </div>
                ))}
                {(!stats.recentResearch || stats.recentResearch.length === 0) && (
                    <div className="text-center text-slate-400 text-sm py-4">
                        {t('dashboard.no_research')}
                    </div>
                )}
              </div>
           </div>
        </div>

      </div>
    </div>
  );
}
