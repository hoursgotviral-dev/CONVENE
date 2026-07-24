import React, { useState, useEffect } from 'react';
import { BudgetItem } from '../types';
import { useWorkspace } from '../context/WorkspaceContext';
import { 
  Coins, 
  Sparkles, 
  CheckCircle2, 
  Settings, 
  ArrowRight, 
  Lock, 
  Sliders, 
  Check, 
  RefreshCw, 
  HelpCircle,
  HelpCircle as InfoIcon,
  AlertTriangle
} from 'lucide-react';

export const BudgetDecision: React.FC = () => {
  const { estimatorOutput } = useWorkspace();
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);

  useEffect(() => {
    if (estimatorOutput && 'breakdown' in estimatorOutput && Array.isArray(estimatorOutput.breakdown)) {
      const newItems: BudgetItem[] = estimatorOutput.breakdown.map((b, i) => {
        const original = Math.round(b.cost * 0.8);
        return {
          id: `b-dyn-${i}`,
          item: b.category,
          allocated: original,
          originalAllocated: original,
          agentRecommended: b.cost,
          agentReasoning: `Agent estimated ${b.hours} hours required for ${b.category} tasks based on your requirements.`,
          approvedByHuman: null
        };
      });
      setBudgetItems(newItems);
    }
  }, [estimatorOutput]);


  const [overrideInputs, setOverrideInputs] = useState<Record<string, string>>({});

  const handleApproveAgent = (id: string) => {
    setBudgetItems(budgetItems.map(item => {
      if (item.id === id) {
        return {
          ...item,
          allocated: item.agentRecommended,
          approvedByHuman: true,
        };
      }
      return item;
    }));
  };

  const handleOverrideSubmit = (id: string, e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(overrideInputs[id]);
    if (isNaN(val) || val < 0) return;

    setBudgetItems(budgetItems.map(item => {
      if (item.id === id) {
        return {
          ...item,
          allocated: val,
          approvedByHuman: false,
          overriddenValue: val,
        };
      }
      return item;
    }));

    // Clear input
    setOverrideInputs({
      ...overrideInputs,
      [id]: '',
    });
  };

  const handleResetItem = (id: string) => {
    setBudgetItems(budgetItems.map(item => {
      if (item.id === id) {
        return {
          ...item,
          allocated: item.originalAllocated,
          approvedByHuman: null,
          overriddenValue: undefined,
        };
      }
      return item;
    }));
  };

  // Calculate totals
  const totalHumanPlanned = budgetItems.reduce((acc, item) => {
    // Original values prior to updates
    const originalMap: Record<string, number> = { 'b-1': 800, 'b-2': 450, 'b-3': 600, 'b-4': 300 };
    return acc + originalMap[item.id];
  }, 0);

  const totalAgentRecommended = budgetItems.reduce((acc, item) => acc + item.agentRecommended, 0);
  const totalAdjustedFinal = budgetItems.reduce((acc, item) => acc + item.allocated, 0);

  return (
    <div id="budget-decision-container" className="space-y-6 select-none">
      
      {/* Intro info bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-sys-panel p-4 border border-sys-border rounded-2xl">
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-neutral-100 uppercase tracking-wider font-display">
            Resourcing & Decision Matrix
          </h2>
          <p className="text-xs text-neutral-400 font-sans">
            AI Agent monitors workload usage and recommends budget adjustments. Humans keep absolute final veto control.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-human/10 px-3 py-1.5 rounded-lg border border-human/20 text-[11px] font-mono text-white">
          <Sliders className="w-3.5 h-3.5 text-human" />
          <span className="font-semibold uppercase tracking-wider">Veto Autonomy Enabled</span>
        </div>
      </div>

      {/* Main Grid: Ledger & Summary Cards */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Budget ledger (Left 8 cols) */}
        <div className="xl:col-span-8 space-y-4">
          {budgetItems.map((item) => {
            const isApproved = item.approvedByHuman === true;
            const isOverridden = item.approvedByHuman === false;
            const isPending = item.approvedByHuman === null;

            return (
              <div 
                key={item.id}
                className={`p-4 border rounded-2xl space-y-4 transition-all relative overflow-hidden ${
                  isApproved 
                    ? 'bg-sys-panel border-emerald-500/30 shadow-sm shadow-emerald-500/2' 
                    : isOverridden 
                    ? 'bg-sys-panel border-sys-border' 
                    : 'bg-sys-panel border-sys-border shadow-md'
                }`}
              >
                
                {/* Header title & State stamp */}
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest block">
                      RESOURCE_ID: {item.id}
                    </span>
                    <h3 className="text-xs font-bold text-neutral-200 uppercase font-display">
                      {item.item}
                    </h3>
                  </div>

                  {/* Visual Stamps */}
                  <div>
                    {isApproved && (
                      <span className="text-[9px] font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1 animate-fadeIn">
                        <Check className="w-3 h-3" />
                        AGENT RECOMMENDATION ENFORCED
                      </span>
                    )}
                    {isOverridden && (
                      <span className="text-[9px] font-bold font-mono bg-agent/10 text-agent border border-agent/20 px-2.5 py-1 rounded-lg flex items-center gap-1 animate-fadeIn">
                        <AlertTriangle className="w-3 h-3" />
                        HUMAN VETO APPLIED (${item.allocated})
                      </span>
                    )}
                    {isPending && (
                      <span className="text-[9px] font-bold font-mono bg-agent/10 text-agent border border-agent/20 px-2.5 py-1 rounded-lg flex items-center gap-1 animate-pulse">
                        <Sparkles className="w-3 h-3 text-agent" />
                        PENDING HUMAN DECISION
                      </span>
                    )}
                  </div>
                </div>

                {/* Agent reasoning panel - AGENT ZONE SIGNATURE */}
                <div className="p-3 bg-bg-dark border-2 border-dashed border-agent/30 rounded-2xl space-y-2 relative shadow-inner">
                  <div className="flex items-center gap-2 text-[10px] text-agent font-mono uppercase tracking-wider font-semibold">
                    <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                    <span>Estimator Agent Projections & Reasoning</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed font-sans">
                    {item.agentReasoning}
                  </p>
                </div>

                {/* Interactive sliders & pricing comparisons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  
                  {/* Allocation parameters */}
                  <div className="space-y-3">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-neutral-500">Current allocation:</span>
                      <span className="text-neutral-300 font-bold">${item.allocated} / mo</span>
                    </div>

                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-agent">Agent recommended:</span>
                      <span className="text-agent font-bold">${item.agentRecommended} / mo</span>
                    </div>

                    {/* Dual comparison bar chart */}
                    <div className="space-y-1.5 bg-bg-dark p-2.5 rounded-lg border border-sys-border">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] text-neutral-500 font-mono">
                          <span>HUMAN LEVEL</span>
                          <span>${item.allocated}</span>
                        </div>
                        <div className="w-full bg-sys-panel h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-neutral-600 h-full transition-all duration-300" 
                            style={{ width: `${Math.min(100, (item.allocated / 2000) * 100)}%` }} 
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] text-agent font-mono">
                          <span>AGENT OPTIMAL</span>
                          <span>${item.agentRecommended}</span>
                        </div>
                        <div className="w-full bg-sys-panel h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-agent h-full transition-all duration-300" 
                            style={{ width: `${(item.agentRecommended / 2000) * 100}%` }} 
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Veto / Override interactive form controls */}
                  <div className="flex flex-col justify-end gap-2.5">
                    {isPending ? (
                      <div className="space-y-2">
                        <button
                          onClick={() => handleApproveAgent(item.id)}
                          className="w-full py-2 bg-human hover:bg-human/90 text-white font-bold text-xs rounded-lg transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          Approve Agent Recommendation
                        </button>

                        <form onSubmit={(e) => handleOverrideSubmit(item.id, e)} className="flex gap-2">
                          <input
                            type="number"
                            required
                            min="0"
                            placeholder="Set customized sum"
                            value={overrideInputs[item.id] || ''}
                            onChange={(e) => setOverrideInputs({
                              ...overrideInputs,
                              [item.id]: e.target.value
                            })}
                            className="flex-1 px-3 py-2 bg-bg-dark border border-sys-border rounded-lg text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-human focus:border-human"
                          />
                          <button
                            type="submit"
                            className="px-3.5 py-2 bg-sys-panel hover:bg-sys-panel/80 border border-sys-border text-neutral-300 hover:text-white font-semibold text-xs rounded-lg transition-all cursor-pointer shrink-0"
                          >
                            Veto Override
                          </button>
                        </form>
                      </div>
                    ) : (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleResetItem(item.id)}
                          className="px-3.5 py-2 bg-bg-dark hover:bg-bg-dark/80 border border-sys-border text-neutral-400 hover:text-white text-xs font-semibold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Change Decision
                        </button>
                      </div>
                    )}
                  </div>

                </div>

              </div>
            );
          })}
        </div>

        {/* Real-time calculated ledger summaries (Right 4 cols) */}
        <div className="xl:col-span-4 space-y-6">
          <div className="p-5 bg-sys-panel border border-sys-border rounded-2xl space-y-5 sticky top-24">
            <div>
              <h3 className="text-xs font-bold text-neutral-100 uppercase tracking-wider font-display">
                Decision Summary Ledger
              </h3>
              <p className="text-[11px] text-neutral-400 font-sans">
                Real-time active project cost calculations reflecting human approval and custom override values.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {/* Original plan total */}
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-neutral-500">Human Initial Budget:</span>
                <span className="text-neutral-300">${totalHumanPlanned} / mo</span>
              </div>

              {/* Agent recommended total */}
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-neutral-500">Agent Recommended Total:</span>
                <span className="text-agent font-semibold">${totalAgentRecommended} / mo</span>
              </div>

              {/* Ledger divider */}
              <div className="border-t border-sys-border my-2" />

              {/* Adjusted final total */}
              <div className="flex justify-between items-end">
                <div>
                  <span className="text-[10px] text-neutral-500 font-mono uppercase tracking-widest block">
                    Adjusted Final Sum
                  </span>
                  <span className="text-2xl font-bold text-white font-display">
                    ${totalAdjustedFinal}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-neutral-400 bg-bg-dark border border-sys-border px-2 py-1 rounded-lg">
                  USD / MONTHLY
                </span>
              </div>
            </div>

            {/* Micro visual comparative bars */}
            <div className="space-y-3 p-4 bg-bg-dark rounded-2xl border border-sys-border">
              <span className="text-[10px] text-neutral-500 font-mono uppercase tracking-widest block">
                Visual Budget Delta
              </span>
              <div className="space-y-2">
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] text-neutral-500 font-mono">
                    <span>Initial planned</span>
                    <span>${totalHumanPlanned}</span>
                  </div>
                  <div className="w-full bg-sys-panel h-2 rounded-full overflow-hidden">
                    <div className="bg-neutral-600 h-full" style={{ width: `${(totalHumanPlanned / totalAgentRecommended) * 100}%` }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] text-agent font-mono">
                    <span>Active decisions</span>
                    <span>${totalAdjustedFinal}</span>
                  </div>
                  <div className="w-full bg-sys-panel h-2 rounded-full overflow-hidden">
                    <div className="bg-agent h-full" style={{ width: `${(totalAdjustedFinal / totalAgentRecommended) * 100}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Explanatory notice */}
            <div className="p-3 bg-bg-dark text-[10px] text-neutral-400 leading-normal rounded-2xl border border-sys-border flex items-start gap-2">
              <InfoIcon className="w-3.5 h-3.5 text-neutral-500 shrink-0 mt-0.5" />
              <p>
                Allocations are synced with sandbox limits. Custom overridden rates bypass the model's predictive budget controls.
              </p>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
};
