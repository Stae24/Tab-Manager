import React, { useState, useEffect, useRef } from 'react';
import { Plus, Sun, Moon, ZoomIn, ZoomOut, RefreshCw, Download, Settings, X, Save, ChevronDown, Minus, Plus as PlusIcon, Layers } from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../utils/cn';
import { AppearanceSettingsPanel } from './AppearanceSettingsPanel';

export const Sidebar: React.FC = () => {
  const isDarkMode = useStore(state => state.isDarkMode);
  const toggleTheme = useStore(state => state.toggleTheme);
  const islands = useStore(state => state.islands);
  const vault = useStore(state => state.vault);
  const showVault = useStore(state => state.showVault);
  const setShowVault = useStore(state => state.setShowVault);
  const showAppearancePanel = useStore(state => state.showAppearancePanel);
  const setShowAppearancePanel = useStore(state => state.setShowAppearancePanel);
  
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const appearancePanelRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setShowExportDropdown(false);
      }
      if (showAppearancePanel && appearancePanelRef.current && !appearancePanelRef.current.contains(event.target as Node)) {
        setShowAppearancePanel(false);
      }
    };
    if (showExportDropdown || showAppearancePanel) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showExportDropdown, showAppearancePanel]);

  const handleExport = (format: 'json' | 'csv' | 'md') => {
    const data = { islands, vault };
    let content = '';
    let mimeType = 'text/plain';
    let fileName = `tab-manager-export.${format}`;

    const escapeCsv = (str: string) => {
      if (!str) return '""';
      const escaped = str.replace(/"/g, '""');
      return `"${escaped}"`;
    };

    if (format === 'json') {
      content = JSON.stringify(data, null, 2);
      mimeType = 'application/json';
    } else if (format === 'csv') {
      content = 'Type,Group,Title,URL\n';
      islands.forEach((i: any) => {
        if (i && 'tabs' in i) {
          i.tabs.forEach((t: any) => {
            content += `${escapeCsv('Live')},${escapeCsv(i.title || 'Untitled Group')},${escapeCsv(t.title)},${escapeCsv(t.url)}\n`;
          });
        } else if (i) {
          content += `${escapeCsv('Live')},${escapeCsv('Ungrouped')},${escapeCsv(i.title)},${escapeCsv(i.url)}\n`;
        }
      });
      vault.forEach(i => {
        if ('tabs' in i) {
          i.tabs.forEach(t => {
            content += `${escapeCsv('Vault')},${escapeCsv(i.title || 'Untitled Group')},${escapeCsv(t.title)},${escapeCsv(t.url)}\n`;
          });
        } else {
          content += `${escapeCsv('Vault')},${escapeCsv('Loose Tab')},${escapeCsv(i.title)},${escapeCsv(i.url)}\n`;
        }
      });
      mimeType = 'text/csv';
    } else if (format === 'md') {
      content = '# Tab Manager Export\n\n## Live Workspace\n';
      islands.forEach((i: any) => {
        if (i && 'tabs' in i) {
          content += `### ${i.title || 'Untitled Group'}\n`;
          i.tabs.forEach((t: any) => content += `- [${t.title}](${t.url})\n`);
        } else if (i) {
          content += `- [${i.title}](${i.url})\n`;
        }
      });
      content += '\n## Vault\n';
      vault.forEach(i => {
        if ('tabs' in i) {
          content += `### ${i.title || 'Untitled Group'}\n`;
          i.tabs.forEach(t => content += `- [${t.title}](${t.url})\n`);
        } else {
          content += `- [${i.title}](${i.url})\n`;
        }
      });
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
    
    setShowExportDropdown(false);
  };

  return (
    <div className="relative flex flex-col gap-4 p-4 border-b border-gx-gray bg-gx-dark">
      {/* Logo / Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gx-accent to-gx-red flex items-center justify-center shadow-lg shadow-gx-accent/30">
            <RefreshCw className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide uppercase">
              Island Manager
            </h1>
            <p className="text-[10px] text-gray-500 font-mono">GX EDITION</p>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowAppearancePanel(!showAppearancePanel);
          }}
          className={cn(
            "p-2 rounded-lg transition-all border",
            showAppearancePanel
              ? "bg-gx-cyan/20 border-gx-cyan/50 text-gx-cyan"
              : "bg-gx-gray hover:bg-gx-accent/20 text-gray-400 hover:text-white border-white/5"
          )}
        >
          <Settings size={18} />
        </button>
      </div>

      <div className="flex gap-2">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-gx-gray hover:bg-gx-gray/80 transition-all border border-white/5 hover:border-gx-accent/30"
        >
          {isDarkMode ? <Moon size={14} className="text-gx-accent" /> : <Sun size={14} className="text-yellow-500" />}
          <span className="text-[10px] font-bold uppercase">Theme</span>
        </button>

        {/* Vault toggle */}
        <button
          onClick={() => setShowVault(!showVault)}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all border",
            showVault
              ? "bg-gx-gray border-white/5 hover:bg-gx-gray/80 hover:border-gx-accent/30"
              : "bg-gx-red/10 border-gx-red/20 text-gray-500 hover:bg-gx-red/20 hover:border-gx-red/30"
          )}
        >
          <Save size={14} className={showVault ? "text-gx-red" : "text-gray-500"} />
          <span className="text-[10px] font-bold uppercase">
            Vault {showVault ? 'ON' : 'OFF'}
          </span>
        </button>

        {/* Export Dropdown */}
        <div className="flex-1 relative" ref={exportDropdownRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowExportDropdown(!showExportDropdown);
            }}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-gx-gray hover:bg-gx-gray/80 transition-all border border-white/5 hover:border-gx-accent/30"
          >
            <Download size={14} className="text-gx-red" />
            <span className="text-[10px] font-bold uppercase">Export</span>
            <ChevronDown size={10} className={cn("transition-transform", showExportDropdown && "rotate-180")} />
          </button>
          {showExportDropdown && (
            <div
              className="absolute top-full left-0 mt-1 w-full bg-gx-gray border border-gx-accent/20 rounded-lg shadow-xl overflow-hidden z-50 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleExport('json');
                }}
                className="px-3 py-2 text-[10px] hover:bg-gx-accent/20 text-left text-gray-400 hover:text-gray-200 transition-all"
              >
                JSON
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleExport('csv');
                }}
                className="px-3 py-2 text-[10px] hover:bg-gx-accent/20 text-left border-t border-white/5 text-gray-400 hover:text-gray-200 transition-all"
              >
                CSV
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleExport('md');
                }}
                className="px-3 py-2 text-[10px] hover:bg-gx-accent/20 text-left border-t border-white/5 text-gray-400 hover:text-gray-200 transition-all"
              >
                Markdown
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Appearance Settings Panel (Slide-over) */}
      <div ref={appearancePanelRef}>
        <AppearanceSettingsPanel
          isOpen={showAppearancePanel}
          onClose={() => setShowAppearancePanel(false)}
        />
      </div>
    </div>
  );
};
