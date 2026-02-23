import React, { useState, useMemo } from 'react';
import { X, Edit } from 'lucide-react';

export function KnowledgeHeatmap({ data, onNodeClick }) {
  const [selectedCell, setSelectedCell] = useState(null); // { importance: 1, difficulty: 1 }

  // Flatten all items
  const allItems = useMemo(() => {
    return data.flatMap(mod => mod.items);
  }, [data]);

  // Group items into 5x5 grid
  const gridData = useMemo(() => {
    const grid = Array(5).fill(null).map(() => Array(5).fill(null).map(() => []));
    
    allItems.forEach(item => {
      // Default to 3 if not set
      const imp = item.importance || 3;
      const diff = item.difficulty || 3;
      
      // Map 1-5 to index 0-4
      // Ensure bounds
      const impIdx = Math.max(0, Math.min(4, imp - 1));
      const diffIdx = Math.max(0, Math.min(4, diff - 1));
      
      grid[impIdx][diffIdx].push(item);
    });
    
    return grid;
  }, [allItems]);

  // Color gradient logic
  // Top-Left (Imp 1, Diff 1) -> Red
  // Bottom-Right (Imp 5, Diff 5) -> Green
  // We can calculate a hue value.
  // Red ~ 0, Green ~ 120
  // Distance from Top-Left: d = (impIdx + diffIdx)
  // Max distance = 4 + 4 = 8
  // Hue = (d / 8) * 120
  const getCellColor = (impIdx, diffIdx) => {
    const dist = impIdx + diffIdx;
    const hue = (dist / 8) * 120; // 0 to 120
    return `hsla(${hue}, 70%, 90%, 1)`;
  };
  
  const getCellBorderColor = (impIdx, diffIdx) => {
    const dist = impIdx + diffIdx;
    const hue = (dist / 8) * 120;
    return `hsla(${hue}, 70%, 40%, 1)`;
  };

  return (
    <div className="w-full h-full flex gap-4 p-4 overflow-hidden">
      {/* Heatmap Grid */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-2 px-2">
           <h3 className="font-bold text-slate-700">知识分布热力图</h3>
           <div className="text-xs text-slate-500 flex gap-4">
             <span className="flex items-center gap-1"><div className="w-3 h-3 bg-red-100 border border-red-500 rounded"></div> 核心/困难</span>
             <span className="flex items-center gap-1"><div className="w-3 h-3 bg-green-100 border border-green-500 rounded"></div> 外围/简单</span>
           </div>
        </div>

        {/* X Axis Label */}
        <div className="flex ml-12 mb-2">
            <div className="flex-1 text-center text-xs font-bold text-slate-500">困难 (1)</div>
            <div className="flex-1 text-center text-xs font-bold text-slate-500">较难 (2)</div>
            <div className="flex-1 text-center text-xs font-bold text-slate-500">中等 (3)</div>
            <div className="flex-1 text-center text-xs font-bold text-slate-500">较易 (4)</div>
            <div className="flex-1 text-center text-xs font-bold text-slate-500">简单 (5)</div>
        </div>

        <div className="flex flex-1 min-h-0">
           {/* Y Axis Label */}
           <div className="w-12 flex flex-col justify-around text-xs font-bold text-slate-500 pr-2">
              <div className="text-right">核心 (1)</div>
              <div className="text-right">重要 (2)</div>
              <div className="text-right">普通 (3)</div>
              <div className="text-right">次要 (4)</div>
              <div className="text-right">外围 (5)</div>
           </div>

           {/* Grid Container */}
           <div className="flex-1 grid grid-cols-5 grid-rows-5 gap-2">
              {gridData.map((row, impIdx) => (
                  row.map((items, diffIdx) => {
                      const bgColor = getCellColor(impIdx, diffIdx);
                      const borderColor = getCellBorderColor(impIdx, diffIdx);
                      const isSelected = selectedCell?.importance === impIdx + 1 && selectedCell?.difficulty === diffIdx + 1;
                      
                      return (
                        <div 
                          key={`${impIdx}-${diffIdx}`}
                          onClick={() => setSelectedCell({ importance: impIdx + 1, difficulty: diffIdx + 1, items })}
                          className={`
                            rounded-lg border-2 flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-105 hover:shadow-md relative
                            ${isSelected ? 'ring-2 ring-blue-500 z-10 scale-105 shadow-lg' : ''}
                          `}
                          style={{ 
                              backgroundColor: bgColor,
                              borderColor: borderColor,
                          }}
                        >
                           <div className="text-2xl font-bold" style={{ color: borderColor }}>
                             {items.length}
                           </div>
                           <div className="text-[10px] text-slate-600 font-medium mt-1">
                             知识点
                           </div>
                        </div>
                      );
                  })
              ))}
           </div>
        </div>
      </div>

      {/* Side Panel for Cell Details */}
      {selectedCell && (
        <div className="w-80 bg-white border-l border-slate-200 shadow-lg flex flex-col animate-in slide-in-from-right duration-200">
           <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
             <div>
               <h3 className="font-bold text-slate-800">
                 {selectedCell.importance}星 / {selectedCell.difficulty}级
               </h3>
               <p className="text-xs text-slate-500">
                 共 {selectedCell.items.length} 个知识点
               </p>
             </div>
             <button onClick={() => setSelectedCell(null)} className="p-1 hover:bg-slate-200 rounded text-slate-400">
               <X className="w-4 h-4" />
             </button>
           </div>
           
           <div className="flex-1 overflow-y-auto p-4 space-y-3">
             {selectedCell.items.length === 0 ? (
               <div className="text-center text-slate-400 py-10">该区域暂无知识点</div>
             ) : (
               selectedCell.items.map(item => (
                 <div 
                   key={item.id} 
                   onClick={() => onNodeClick(item)}
                   className="p-3 bg-white border border-slate-200 rounded hover:border-blue-400 hover:shadow-sm cursor-pointer group"
                 >
                   <div className="font-bold text-slate-700 text-sm mb-1 group-hover:text-blue-600">{item.term}</div>
                   <div className="text-xs text-slate-500 line-clamp-2">{item.definition}</div>
                 </div>
               ))
             )}
           </div>
        </div>
      )}
    </div>
  );
}
